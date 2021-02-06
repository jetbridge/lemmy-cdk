import { ApplicationLoadBalancer } from "@aws-cdk/aws-elasticloadbalancingv2";
import { ARecord, HostedZone, RecordTarget } from "@aws-cdk/aws-route53";
import * as core from "@aws-cdk/core";
import { Duration } from "@aws-cdk/core";
import { Bastion } from "./bastion";
import { SiteCDN } from "./cdn";
import { siteConfig } from "./config";
import { LemmyDomain } from "./lemmy/dns";

interface IDomainProps {
  loadBalancer: ApplicationLoadBalancer;
  bastion: Bastion;
  cdn: SiteCDN;
}

export class DNS extends core.Construct {
  constructor(
    scope: core.Construct,
    id: string,
    { loadBalancer, bastion, cdn }: IDomainProps
  ) {
    super(scope, id);

    const zone = HostedZone.fromLookup(this, "HostedZone", {
      domainName: siteConfig.siteDomainName,
    });

    // CDN DNS
    new LemmyDomain(this, "Lemmy", { cdn, zone });

    // bastion DNS
    new ARecord(this, "BastionRecord", {
      zone,
      target: RecordTarget.fromIpAddresses(bastion.elasticIp.ref),
      comment: "Bastion",
      recordName: "bastion",
      ttl: Duration.minutes(30),
    });
  }
}
