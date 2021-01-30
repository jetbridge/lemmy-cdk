import elbv2 = require("@aws-cdk/aws-elasticloadbalancingv2");
import * as core from "@aws-cdk/core";
import { Certificate } from "@aws-cdk/aws-certificatemanager";
import { HostedZone } from "@aws-cdk/aws-route53";
import { Vpc } from "@aws-cdk/aws-ec2";

interface ILBProps {
  vpc: Vpc;
}

export class LemmyLoadBalancer extends core.Construct {
  backendTargetGroup: elbv2.ApplicationTargetGroup;
  frontendTargetGroup: elbv2.ApplicationTargetGroup;
  alb: elbv2.ApplicationLoadBalancer;

  constructor(scope: core.Construct, id: string, { vpc }: ILBProps) {
    super(scope, id);

    // ALB
    const lb = new elbv2.ApplicationLoadBalancer(this, "LemmyLB", {
      vpc,
      internetFacing: true,
    });

    // listeners
    const listener = lb.addListener("Listener", {
      port: 80,
      // certificates: [],
    });
    listener.connections.allowDefaultPortFromAnyIpv4("Open to the world");

    // target group for lemmy backend
    const backendTg = new elbv2.ApplicationTargetGroup(
      this,
      "LemmyBETargetGroup",
      { vpc, protocol: elbv2.ApplicationProtocol.HTTP, port: 8536 }
    );
    // target group for lemmy frontend
    const frontendTg = new elbv2.ApplicationTargetGroup(
      this,
      "LemmyFETargetGroup",
      { vpc, protocol: elbv2.ApplicationProtocol.HTTP, port: 1234 }
    );

    // listeners -> target groups
    listener.addTargetGroups("HTTPAppTargetGroups", {
      targetGroups: [frontendTg],
    });

    this.backendTargetGroup = backendTg;
    this.frontendTargetGroup = frontendTg;
    this.alb = lb;
  }
}
