import { Certificate } from "@aws-cdk/aws-certificatemanager";
import {
  AllowedMethods,
  CachePolicy,
  Distribution,
  experimental,
  LambdaEdgeEventType,
  OriginProtocolPolicy,
  OriginRequestPolicy,
  ViewerProtocolPolicy,
} from "@aws-cdk/aws-cloudfront";
import { LoadBalancerV2Origin } from "@aws-cdk/aws-cloudfront-origins";
import { Code, Runtime } from "@aws-cdk/aws-lambda";
import * as core from "@aws-cdk/core";
import * as path from "path";
import { siteConfig } from "./config";
import { IFRAMELY_PORT } from "./lemmy/iframely";
import { LemmyLoadBalancer } from "./lemmy/loadbalancer";

interface ISiteCDNProps {
  lemmyLoadBalancer: LemmyLoadBalancer;
}

export class SiteCDN extends core.Construct {
  distribution: Distribution;

  constructor(scope: core.Construct, id: string, props: ISiteCDNProps) {
    super(scope, id);

    // our load balancer for internal services
    const lemmyLoadBalancerOrigin = new LoadBalancerV2Origin(
      props.lemmyLoadBalancer.alb,
      { protocolPolicy: OriginProtocolPolicy.HTTP_ONLY }
    );
    // same LB but different port
    const iframelyLoadBalancerOrigin = new LoadBalancerV2Origin(
      props.lemmyLoadBalancer.alb,
      {
        protocolPolicy: OriginProtocolPolicy.HTTP_ONLY,
        httpPort: IFRAMELY_PORT,
      }
    );

    // edge lambda to rewrite /framely/(.*) paths
    const requestRewritePathsFunc = new experimental.EdgeFunction(
      this,
      "RewritePathsFunc",
      {
        runtime: Runtime.NODEJS_12_X,
        handler: "cdn-rewrite-paths.handler",
        code: Code.fromAsset(path.join(__dirname, "./edge-lambda")),
      }
    );

    this.distribution = new Distribution(this, "SiteCDN", {
      comment: siteConfig.siteDomainName,
      enableLogging: true,

      // optional HTTPS
      ...(siteConfig.httpsEnabled && siteConfig.siteCertificateArn
        ? {
            certificate: Certificate.fromCertificateArn(
              this,
              "CDNCert",
              siteConfig.siteCertificateArn
            ),
            domainNames: [siteConfig.webDomain],
          }
        : {}),

      // default behavior is to use our ALB backend
      // more URL handling rules can be found in lemmy/loadbalancer.ts
      defaultBehavior: {
        origin: lemmyLoadBalancerOrigin,
        viewerProtocolPolicy: siteConfig.httpsEnabled
          ? ViewerProtocolPolicy.REDIRECT_TO_HTTPS
          : ViewerProtocolPolicy.ALLOW_ALL,
        allowedMethods: AllowedMethods.ALLOW_ALL,
        originRequestPolicy: OriginRequestPolicy.ALL_VIEWER, // pass along headers and cookies
        cachePolicy: CachePolicy.CACHING_DISABLED,
      },
      additionalBehaviors: {
        // route iframely traffic
        "/iframely/*": {
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          originRequestPolicy: OriginRequestPolicy.ALL_VIEWER, // pass along headers and cookies
          cachePolicy: CachePolicy.CACHING_DISABLED,
          origin: iframelyLoadBalancerOrigin,

          // rewrites request path
          edgeLambdas: [
            {
              functionVersion: requestRewritePathsFunc.currentVersion,
              eventType: LambdaEdgeEventType.ORIGIN_REQUEST,
            },
          ],
        },
      },
    });
  }
}
