import { Certificate } from "@aws-cdk/aws-certificatemanager";
import { Distribution, OriginProtocolPolicy } from "@aws-cdk/aws-cloudfront";
import { LoadBalancerV2Origin } from "@aws-cdk/aws-cloudfront-origins";
import * as core from "@aws-cdk/core";
import { siteConfig } from "./config";
import { LemmyLoadBalancer } from "./lemmy/loadbalancer";

interface ISiteCDNProps {
  lemmyLB: LemmyLoadBalancer;
}

export class SiteCDN extends core.Construct {
  distribution: Distribution;

  constructor(scope: core.Construct, id: string, props: ISiteCDNProps) {
    super(scope, id);

    const lemmyLoadBalancerOrigin = new LoadBalancerV2Origin(props.lemmyLB.alb);

    this.distribution = new Distribution(this, "SiteCDN", {
      comment: siteConfig.siteDomainName,
      // certificate: Certificate.fromCertificateArn(
      //   this,
      //   "CDNCert",
      //   siteConfig.siteCertificateArn
      // ),
      domainNames: [
        siteConfig.siteDomainName,
        `www.${siteConfig.siteDomainName}`,
      ],
      // default is to use our ALB backend
      defaultBehavior: {
        origin: lemmyLoadBalancerOrigin,
      },
      // additionalBehaviors: [{}],
    });
  }
}
