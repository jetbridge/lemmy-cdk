import { ApplicationLoadBalancer } from "@aws-cdk/aws-elasticloadbalancingv2";
import { ARecord, HostedZone, RecordTarget } from "@aws-cdk/aws-route53";
import * as core from "@aws-cdk/core";
import { Duration } from "@aws-cdk/core";
import { Bastion } from "./bastion";
import { LemmyDomain } from "./lemmy/dns";

interface IDomainProps {
  loadBalancer: ApplicationLoadBalancer;
  bastion: Bastion;
}

export class DNS extends core.Construct {
  constructor(
    scope: core.Construct,
    id: string,
    { loadBalancer, bastion }: IDomainProps
  ) {
    super(scope, id);

    // TODO: config
    // const zone = HostedZone.fromHostedZoneId(this,"LemmyZone", "Z0266198IOHWFCMZWF2") ;
    const domainName = "federation.dev";

    const zone = HostedZone.fromLookup(this, "HostedZone", {
      domainName,
    });

    // lemmy load balancer DNS
    new LemmyDomain(this, "Lemmy", { loadBalancer, zone });

    // bastion DNS
    new ARecord(this, "BastionRecord", {
      zone,
      target: RecordTarget.fromIpAddresses(bastion.elasticIp.ref),
      comment: "Bastion",
      recordName: "bastion",
      ttl: Duration.minutes(1),
    });
  }
}
