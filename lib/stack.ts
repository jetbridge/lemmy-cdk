import { Port } from "@aws-cdk/aws-ec2";
import * as cdk from "@aws-cdk/core";
import { Bastion } from "./bastion";
import { Database } from "./database";
import { DNS } from "./dns";
import { LemmyECS } from "./lemmy/ecs";
import { LemmyLoadBalancer } from "./lemmy/loadbalancer";
import ec2 = require("@aws-cdk/aws-ec2");

export class Stack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC
    const vpc = new ec2.Vpc(this, "VPC");

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

    // DNS
    const domain = new DNS(this, "DNS", {
      loadBalancer: loadBalancer.alb,
      bastion,
    });

    // ECS
    const ecs = new LemmyECS(this, "LemmyECS", {
      vpc,
      lemmyLB: loadBalancer,
      db: db.cluster,
      dbSecurityGroup: db.securityGroup,
    });
  }
}
