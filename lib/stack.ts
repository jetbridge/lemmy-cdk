import { Port } from "@aws-cdk/aws-ec2";
import * as cdk from "@aws-cdk/core";
import { Bastion } from "./bastion";
import { Database } from "./database";
import { DNS } from "./dns";
import { LemmyECS } from "./lemmy/ecs";
import { LemmyLoadBalancer } from "./lemmy/loadbalancer";
import ec2 = require("@aws-cdk/aws-ec2");
import { FileSystem, LifecyclePolicy, PerformanceMode } from "@aws-cdk/aws-efs";
import { RemovalPolicy } from "@aws-cdk/core";
import { SiteCDN } from "./cdn";

export class Stack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC
    const vpc = new ec2.Vpc(this, "VPC", {
      // increase this if you want to be highly available. costs more.
      natGateways: 1,
    });

    // Bastion
    const bastion = new Bastion(this, "Bastion", { vpc });

    // DB
    const db = new Database(this, "DB", {
      vpc,
    });
    db.securityGroup.addIngressRule(bastion.securityGroup, Port.tcp(5432));

    // ALB
    const loadBalancer = new LemmyLoadBalancer(this, "LemmyLoadBalancer", {
      vpc,
    });

    // CDN
    const cdn = new SiteCDN(this, "CDN", { lemmyLB: loadBalancer });

    // DNS
    const domain = new DNS(this, "DNS", {
      loadBalancer: loadBalancer.alb,
      bastion,
      cdn,
    });

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

    // ECS
    const ecs = new LemmyECS(this, "LemmyECS", {
      vpc,
      fs,
      lemmyLB: loadBalancer,
      db: db.cluster,
      dbSecurityGroup: db.securityGroup,
    });
  }
}
