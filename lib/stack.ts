import * as cdk from "@aws-cdk/core";
import { LemmyApp } from "./lemmy/app";
import ec2 = require("@aws-cdk/aws-ec2");
import { LemmyLoadBalancer } from "./lemmy/loadbalancer";
import { SecurityGroup } from "@aws-cdk/aws-ec2";
import { Database } from "./database";

export class Stack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "VPC");
    const dbSecurityGroup = new SecurityGroup(this, "DBSecurityGroup", {
      vpc,
      description: "Database ingress",
    });

    const db = new Database(this, "DB", {
      vpc,
      securityGroup: dbSecurityGroup,
    });
    const lemmyLB = new LemmyLoadBalancer(this, "LemmyLoadBalancer", { vpc });
    const lemmyApp = new LemmyApp(this, "LemmyApp", {
      db,
      lemmyLB,
      vpc,
      dbSecurityGroup,
    });
  }
}
