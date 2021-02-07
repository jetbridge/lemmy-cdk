import { Port, Vpc } from "@aws-cdk/aws-ec2";
import * as cdk from "@aws-cdk/core";
import { Bastion } from "./bastion";
import { Database } from "./database";
import { DNS } from "./dns";
import { LemmyECS } from "./lemmy/ecs";
import { LemmyLoadBalancer } from "./lemmy/loadbalancer";
import { FileSystem, LifecyclePolicy, PerformanceMode } from "@aws-cdk/aws-efs";
import { RemovalPolicy } from "@aws-cdk/core";
import { SiteCDN } from "./cdn";
import { IFramelyLoadBalancer } from "./lemmy/iframely";
import { siteConfig } from "./config";

export class Stack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC
    const vpc = new Vpc(this, "VPC", {
      // increase this if you want to be highly available. costs more.
      natGateways: 1,
    });

    // DB
    const db = new Database(this, "DB", {
      vpc,
    });

    // Bastion host
    let bastion;
    if (siteConfig.bastionKeypairName) {
      bastion = new Bastion(this, "Bastion", { vpc });
      db.securityGroup.addIngressRule(bastion.securityGroup, Port.tcp(5432));
    }

    // EFS - storage for files
    const fs = new FileSystem(this, "FS", {
      vpc,
      encrypted: true,
      lifecyclePolicy: LifecyclePolicy.AFTER_60_DAYS,
      performanceMode: PerformanceMode.GENERAL_PURPOSE,
      removalPolicy: RemovalPolicy.RETAIN,
      fileSystemName: "LemmyFS",
      enableAutomaticBackups: false,
    });

    // ALBs
    const lemmyLoadBalancer = new LemmyLoadBalancer(this, "LemmyLoadBalancer", {
      vpc,
    });
    const iframelyLoadBalancer = new IFramelyLoadBalancer(
      this,
      "IFramelyLoadBalancer",
      {
        vpc,
      }
    );

    // CDN
    const cdn = new SiteCDN(this, "CDN", {
      lemmyLoadBalancer,
      iframelyLoadBalancer,
    });

    // DNS
    const domain = new DNS(this, "DNS", {
      lemmyLoadBalancer: lemmyLoadBalancer.alb,
      bastion,
      cdn,
    });

    // ECS
    const ecs = new LemmyECS(this, "LemmyECS", {
      vpc,
      fs,
      lemmyLoadBalancer,
      iframelyLoadBalancer,
      db: db.cluster,
      dbSecurityGroup: db.securityGroup,
    });
  }
}
