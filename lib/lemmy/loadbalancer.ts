import { Certificate } from "@aws-cdk/aws-certificatemanager";
import { Vpc } from "@aws-cdk/aws-ec2";
import {
  AddApplicationActionProps,
  ApplicationLoadBalancer,
  ApplicationProtocol,
  ApplicationTargetGroup,
  IpAddressType,
  ListenerAction,
  ListenerCondition,
  TargetType,
} from "@aws-cdk/aws-elasticloadbalancingv2";
import * as core from "@aws-cdk/core";
import { Duration } from "@aws-cdk/core";
import { IFRAMELY_PORT } from "./iframely";
import { PICTRS_PORT } from "./pictrs";

interface ILBProps {
  vpc: Vpc;
}

export class LemmyLoadBalancer extends core.Construct {
  backendTargetGroup: ApplicationTargetGroup;
  frontendTargetGroup: ApplicationTargetGroup;
  iframelyTargetGroup: ApplicationTargetGroup;
  pictrsTargetGroup: ApplicationTargetGroup;
  alb: ApplicationLoadBalancer;

  constructor(scope: core.Construct, id: string, { vpc }: ILBProps) {
    super(scope, id);

    // ALB
    const lb = new ApplicationLoadBalancer(this, "LemmyLB", {
      vpc,
      internetFacing: true,
      http2Enabled: true,
      ipAddressType: IpAddressType.IPV4, // dual-stack would be nice, not super easy to do yet
    });

    // target group for lemmy backend
    const backendTg = new ApplicationTargetGroup(this, "LemmyBETargetGroup", {
      vpc,
      protocol: ApplicationProtocol.HTTP,
      port: 8536,
      targetGroupName: "Lemmy-Backend-v2",
      targetType: TargetType.IP,
      healthCheck: {
        path: "/api/v2/categories",
        interval: Duration.seconds(10),
        healthyThresholdCount: 2,
      },
    });
    // target group for lemmy frontend
    const frontendTg = new ApplicationTargetGroup(this, "LemmyFETargetGroup", {
      vpc,
      protocol: ApplicationProtocol.HTTP,
      port: 1234,
      targetType: TargetType.IP,
      targetGroupName: "Lemmy-Frontend-v2",
      healthCheck: {
        interval: Duration.seconds(10),
        healthyThresholdCount: 2,
      },
    });
    // target group for pictrs
    const pictrsTg = new ApplicationTargetGroup(this, "PictrsTargetGroup", {
      vpc,
      protocol: ApplicationProtocol.HTTP,
      port: PICTRS_PORT,
      targetType: TargetType.IP,
      targetGroupName: "Pictrs-v2",
      healthCheck: {
        interval: Duration.seconds(10),
        healthyThresholdCount: 2,
        healthyHttpCodes: "200,404", // TODO: good health check endpoint?
      },
    });
    // target group for iframely
    const iframelyTg = new ApplicationTargetGroup(this, "IFramelyTargetGroup", {
      vpc,
      protocol: ApplicationProtocol.HTTP,
      port: IFRAMELY_PORT,
      targetType: TargetType.IP,
      targetGroupName: "IFramely",
      healthCheck: {
        interval: Duration.seconds(10),
        healthyThresholdCount: 2,
        healthyHttpCodes: "302",
      },
    });

    // listeners -> target groups

    // listeners
    const httpListener = lb.addListener("FrontendHTTPListener", {
      protocol: ApplicationProtocol.HTTP,
      open: true,
      defaultTargetGroups: [frontendTg],
    });
    const httpsListener = lb.addListener("FrontendHTTPSListener", {
      protocol: ApplicationProtocol.HTTPS,
      open: true,
      defaultTargetGroups: [frontendTg],
      certificates: [
        // TODO: config
        Certificate.fromCertificateArn(
          this,
          "FedDevCert",
          "arn:aws:acm:us-west-2:450542611688:certificate/68f4c06e-b71e-4c71-bd89-7ee5efc0233b"
        ),
      ],
    });
    httpListener.connections.allowDefaultPortFromAnyIpv4("Open to the world");

    const routes: AddApplicationActionProps[] = [
      // /api/* -> backend
      {
        action: ListenerAction.forward([backendTg]),
        conditions: [ListenerCondition.pathPatterns(["/api/*", "/pictrs/*"])],
        priority: 1,
      },
      // /pictrs/* DISABLED
      // {
      //   action: ListenerAction.forward([pictrsTg]),
      //   conditions: [ListenerCondition.pathPatterns(["/zzzzpictrs/*"])],
      //   priority: 2,
      // },
      // /iframely/*
      {
        action: ListenerAction.forward([iframelyTg]),
        conditions: [ListenerCondition.pathPatterns(["/iframely/*"])],
        priority: 2,
      },
    ];
    routes.forEach((routeAction, index) => {
      httpListener.addAction(`BackendHTTPAPIRouter-${index}`, routeAction);
      httpsListener.addAction(`BackendHTTPSAPIRouter-${index}`, routeAction);
    });

    // backend listener - maybe not needed?
    const backendListener = lb.addListener("BackendListener", {
      port: 8536,
      open: false,
      defaultTargetGroups: [backendTg],
      protocol: ApplicationProtocol.HTTP,
    });

    this.backendTargetGroup = backendTg;
    this.frontendTargetGroup = frontendTg;
    this.iframelyTargetGroup = iframelyTg;
    this.pictrsTargetGroup = pictrsTg;
    this.alb = lb;
  }
}
