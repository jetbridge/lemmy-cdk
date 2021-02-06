import { ApplicationLoadBalancer } from "@aws-cdk/aws-elasticloadbalancingv2";
import {
  AaaaRecord,
  ARecord,
  CnameRecord,
  IHostedZone,
  RecordTarget,
} from "@aws-cdk/aws-route53";
import { CloudFrontTarget } from "@aws-cdk/aws-route53-targets";
import * as core from "@aws-cdk/core";
import { SiteCDN } from "../cdn";

interface IDomainProps {
  zone: IHostedZone;
  cdn: SiteCDN;
}
export class LemmyDomain extends core.Construct {
  constructor(scope: core.Construct, id: string, { zone, cdn }: IDomainProps) {
    super(scope, id);

    // CDN target
    const target = RecordTarget.fromAlias(
      new CloudFrontTarget(cdn.distribution)
    );

    // create A, AAAA, CNAME for www.
    const recordProps = {
      zone,
      target,
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
