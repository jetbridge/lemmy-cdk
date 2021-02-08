import { Certificate } from "@aws-cdk/aws-certificatemanager";
import { Distribution, ViewerProtocolPolicy } from "@aws-cdk/aws-cloudfront";
import { S3Origin } from "@aws-cdk/aws-cloudfront-origins";
import {
  AaaaRecord,
  ARecord,
  IHostedZone,
  RecordTarget,
} from "@aws-cdk/aws-route53";
import { CloudFrontTarget } from "@aws-cdk/aws-route53-targets";
import { Bucket, RedirectProtocol } from "@aws-cdk/aws-s3";
import * as core from "@aws-cdk/core";
import { siteConfig } from "./config";

interface IDomainProps {
  zone: IHostedZone;
}

// redirect foo.com to www.foo.com
// creates a S3 static bucket to perform the redirect
// creates a CloudFront distribution to terminate SSL
export class RootRedirect extends core.Construct {
  constructor(scope: core.Construct, id: string, { zone }: IDomainProps) {
    super(scope, id);

    // Create a S3 website bucket that redirects domainName to www.domainName
    const redirBucket = new Bucket(this, "RedirectToWWWBucket", {
      // doesn't exist but is required
      websiteErrorDocument: "index.html",
      websiteIndexDocument: "index.html",
      websiteRoutingRules: [
        {
          protocol: siteConfig.httpsEnabled
            ? RedirectProtocol.HTTPS
            : RedirectProtocol.HTTP,
          hostName: siteConfig.webDomain,
        },
      ],
    });

    // CloudFront distribution in front of S3 bucket
    // handles SSL
    const distribution = new Distribution(this, "RedirDistribution", {
      comment: "Redirect to WWW",
      enableLogging: false,

      defaultBehavior: {
        origin: new S3Origin(redirBucket),
        viewerProtocolPolicy: siteConfig.httpsEnabled
          ? ViewerProtocolPolicy.REDIRECT_TO_HTTPS
          : ViewerProtocolPolicy.ALLOW_ALL,
      },

      // optional HTTPS
      ...(siteConfig.httpsEnabled && siteConfig.siteCertificateArn
        ? {
            certificate: Certificate.fromCertificateArn(
              this,
              "CDNCert",
              siteConfig.siteCertificateArn
            ),
            domainNames: [siteConfig.siteDomainName],
          }
        : {}),
    });

    // CDN target
    const cdnTarget = RecordTarget.fromAlias(
      new CloudFrontTarget(distribution)
    );

    // root domainName - redirects to www.
    new ARecord(this, "LemmyAWebRecord", {
      zone,
      target: cdnTarget,
      recordName: "",
    });
    new AaaaRecord(this, "LemmyAAAAWebRecord", {
      zone,
      target: cdnTarget,
      recordName: "",
    });
  }
}
