import { Certificate } from "@aws-cdk/aws-certificatemanager";
import {
  Distribution,
  ViewerProtocolPolicy,
  AllowedMethods,
  OriginProtocolPolicy,
} from "@aws-cdk/aws-cloudfront";
import { LoadBalancerV2Origin } from "@aws-cdk/aws-cloudfront-origins";
import * as core from "@aws-cdk/core";
import { siteConfig } from "./config";
import { IFramelyLoadBalancer } from "./lemmy/iframely";
import { LemmyLoadBalancer } from "./lemmy/loadbalancer";

interface ISiteCDNProps {
  lemmyLoadBalancer: LemmyLoadBalancer;
  iframelyLoadBalancer: IFramelyLoadBalancer;
}

export class SiteCDN extends core.Construct {
  distribution: Distribution;

  constructor(scope: core.Construct, id: string, props: ISiteCDNProps) {
    super(scope, id);

    // our load balancers for internal services
    const lemmyLoadBalancerOrigin = new LoadBalancerV2Origin(
      props.lemmyLoadBalancer.alb,
      { protocolPolicy: OriginProtocolPolicy.HTTP_ONLY }
    );
    const iframelyLoadBalancerOrigin = new LoadBalancerV2Origin(
      props.iframelyLoadBalancer.alb,
      { protocolPolicy: OriginProtocolPolicy.HTTP_ONLY }
    );

    // const myFunc = new experimental.EdgeFunction(this, "MyFunction", {
    //   runtime: Runtime.NODEJS_12,
    //   handler: "index.handler",
    //   code: Code.fromAsset(path.join(__dirname, "../src/cdn-rewrite-paths")),
    // });

    this.distribution = new Distribution(this, "SiteCDN", {
      comment: siteConfig.siteDomainName,
      certificate: Certificate.fromCertificateArn(
        this,
        "CDNCert",
        siteConfig.siteCertificateArn
      ),
      domainNames: [
        siteConfig.siteDomainName,
        `www.${siteConfig.siteDomainName}`,
      ],
      // default is to use our ALB backend
      defaultBehavior: {
        origin: lemmyLoadBalancerOrigin,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: AllowedMethods.ALLOW_ALL,
      },
      additionalBehaviors: {
        // route iframely traffic
        "/iframely/*": {
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          origin: iframelyLoadBalancerOrigin,
        },
      },
    });
  }
}
