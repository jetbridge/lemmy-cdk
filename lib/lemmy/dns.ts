import { ApplicationLoadBalancer } from "@aws-cdk/aws-elasticloadbalancingv2";
import {
  AaaaRecord,
  ARecord,
  CnameRecord,
  IHostedZone,
  RecordTarget,
} from "@aws-cdk/aws-route53";
import { LoadBalancerTarget } from "@aws-cdk/aws-route53-targets";
import * as core from "@aws-cdk/core";

interface IDomainProps {
  loadBalancer: ApplicationLoadBalancer;
  zone: IHostedZone;
}
export class LemmyDomain extends core.Construct {
  constructor(
    scope: core.Construct,
    id: string,
    { loadBalancer, zone }: IDomainProps
  ) {
    super(scope, id);

    // Load balancer target
    const target = RecordTarget.fromAlias(new LoadBalancerTarget(loadBalancer));

    // create A, AAAA, CNAME for www.
    // point at Load Balancer
    const recordProps = {
      zone,
      target,
      comment: "Lemmy load balancer",
    };
    const aRec = new ARecord(this, "LemmyAWebRecord", {
      ...recordProps,
      recordName: "",
    });
    new AaaaRecord(this, "LemmyAAAAWebRecord", {
      ...recordProps,
      recordName: "",
    });
    new CnameRecord(this, "LemmyCNAMEWWWRecord", {
      recordName: "www",
      domainName: zone.zoneName,
      ...recordProps,
    });
  }
}
