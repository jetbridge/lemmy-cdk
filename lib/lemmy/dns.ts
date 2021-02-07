import { ApplicationLoadBalancer } from "@aws-cdk/aws-elasticloadbalancingv2";
import {
  AaaaRecord,
  ARecord,
  CnameRecord,
  IHostedZone,
  RecordTarget,
} from "@aws-cdk/aws-route53";
import {
  CloudFrontTarget,
  LoadBalancerTarget,
} from "@aws-cdk/aws-route53-targets";
import * as core from "@aws-cdk/core";
import { SiteCDN } from "../cdn";

interface IDomainProps {
  zone: IHostedZone;
  cdn: SiteCDN;
  lemmyLoadBalancer: ApplicationLoadBalancer;
}
export class LemmyDomain extends core.Construct {
  constructor(
    scope: core.Construct,
    id: string,
    { zone, cdn, lemmyLoadBalancer }: IDomainProps
  ) {
    super(scope, id);

    // CDN target
    const cdnTarget = RecordTarget.fromAlias(
      new CloudFrontTarget(cdn.distribution)
    );
    const apiTarget = RecordTarget.fromAlias(
      new LoadBalancerTarget(lemmyLoadBalancer)
    );

    // API
    new ARecord(this, "LemmyAPIAWebRecord", {
      zone,
      target: apiTarget,
      comment: "Lemmy API",
      recordName: "api",
    });
    new AaaaRecord(this, "LemmyAPIAAAAWebRecord", {
      zone,
      target: apiTarget,
      comment: "Lemmy API",
      recordName: "api",
    });

    // create A, AAAA, CNAME for www.
    // A, AAAA for api.
    const recordProps = {
      zone,
      target: cdnTarget,
      comment: "Lemmy CDN",
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
