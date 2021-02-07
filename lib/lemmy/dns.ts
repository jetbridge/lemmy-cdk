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
  BucketWebsiteTarget,
} from "@aws-cdk/aws-route53-targets";
import * as core from "@aws-cdk/core";
import { SiteCDN } from "../cdn";
import { Bucket } from "@aws-cdk/aws-s3";
import { siteConfig } from "../config";

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

    // Create a S3 website bucket that redirects domainName to www.domainName
    const redirBucket = new Bucket(this, "RedirectToWWWBucket", {
      bucketName: siteConfig.siteDomainName,
      websiteRedirect: { hostName: `www.${siteConfig.siteDomainName}` },
    });

    // CDN target
    const cdnTarget = RecordTarget.fromAlias(
      new CloudFrontTarget(cdn.distribution)
    );
    const apiTarget = RecordTarget.fromAlias(
      new LoadBalancerTarget(lemmyLoadBalancer)
    );
    const redirWWWTarget = RecordTarget.fromAlias(
      new BucketWebsiteTarget(redirBucket)
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

    // root domainName - redirects to www.
    new ARecord(this, "LemmyAWebRecord", {
      zone,
      target: redirWWWTarget,
      recordName: "",
    });
    new AaaaRecord(this, "LemmyAAAAWebRecord", {
      zone,
      target: redirWWWTarget,
      recordName: "",
    });

    // www
    new ARecord(this, "LemmyWWWARecord", {
      recordName: "www",
      target: cdnTarget,
      zone,
      comment: "Site CloudFront",
    });
    new AaaaRecord(this, "LemmyWWWAAAARecord", {
      recordName: "www",
      target: cdnTarget,
      zone,
      comment: "Site CloudFront",
    });
  }
}
