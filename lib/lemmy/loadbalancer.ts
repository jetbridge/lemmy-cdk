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
import { siteConfig } from "../config";
import { IFRAMELY_PORT } from "./iframely";

interface ILBProps {
  vpc: Vpc;
}

export class LemmyLoadBalancer extends core.Construct {
  backendTargetGroup: ApplicationTargetGroup;
  frontendTargetGroup: ApplicationTargetGroup;
  iframelyTargetGroup: ApplicationTargetGroup;
  alb: ApplicationLoadBalancer;

  constructor(scope: core.Construct, id: string, { vpc }: ILBProps) {
    super(scope, id);

    // ALB
    const lb = new ApplicationLoadBalancer(this, "LemmyLB", {
      vpc,
      internetFacing: true,
      http2Enabled: false,
      ipAddressType: IpAddressType.IPV4, // dual-stack would be nice, not super easy to do yet
    });

    // target group for lemmy backend
    const backendTg = new ApplicationTargetGroup(this, "LemmyBETargetGroup", {
      vpc,
      protocol: ApplicationProtocol.HTTP,
      port: 8536,
      targetGroupName: "Lemmy-Backend",
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
      targetGroupName: "Lemmy-Frontend",
      healthCheck: {
        interval: Duration.seconds(10),
        healthyThresholdCount: 2,
      },
    });

    // target group for iframely
    const iframelyTg = new ApplicationTargetGroup(this, "IFramelyTargetGroup", {
      vpc,
      protocol: ApplicationProtocol.HTTP,
      port: IFRAMELY_PORT,
      targetType: TargetType.IP,
      targetGroupName: "IFramely-v2",
      healthCheck: {
        interval: Duration.seconds(10),
        healthyThresholdCount: 2,
        healthyHttpCodes: "302",
      },
    });

    const iframelyHttpListener = lb.addListener("IFramelyHTTPListener", {
      protocol: ApplicationProtocol.HTTP,
      open: true,
      defaultTargetGroups: [iframelyTg],
      port: IFRAMELY_PORT,
    });
    // TODO: limit to CF and internal services
    iframelyHttpListener.connections.allowDefaultPortFromAnyIpv4(
      "Open to the world"
    );

    // listener
    const httpListener = lb.addListener("FrontendHTTPListener", {
      protocol: ApplicationProtocol.HTTP,
      open: true,
      // route requests to frontend by default
      defaultTargetGroups: [frontendTg],
    });

    // TODO: limit to CF and internal services
    httpListener.connections.allowDefaultPortFromAnyIpv4("Open to the world");

    // routing rules
    // from: https://raw.githubusercontent.com/LemmyNet/lemmy/main/ansible/templates/nginx.conf
    const actions: AddApplicationActionProps[] = [
      {
        // /api|pictrs|feeds|nodeinfo|.well-known/* -> backend
        action: ListenerAction.forward([backendTg]),
        conditions: [
          // backend requests
          ListenerCondition.pathPatterns([
            "/api/*",
            "/pictrs/*",
            "/feeds/*",
            "/nodeinfo*",
            ".well-known/*",
          ]),
        ],
        priority: 10,
      },
      {
        action: ListenerAction.forward([backendTg]),
        conditions: [
          // accept: activitypub
          ListenerCondition.httpHeader("accept", [
            "application/activity+json",
            `application/ld+json; profile="https://www.w3.org/ns/activitystreams"`,
          ]),
        ],
        priority: 20,
      },
      {
        action: ListenerAction.forward([backendTg]),
        conditions: [
          // POSTs
          ListenerCondition.httpRequestMethods(["POST"]),
        ],
        priority: 30,
      },
    ];

    // HTTP listener actions
    actions.forEach((action, i) =>
      httpListener.addAction(`HTTPRule${i}`, action)
    );

    // HTTPS listener actions, if enabled
    if (siteConfig.httpsEnabled && siteConfig.siteCertificateArn) {
      const httpsListener = lb.addListener("FrontendHTTPSListener", {
        protocol: ApplicationProtocol.HTTPS,
        open: true,
        // route requests to frontend by default
        defaultTargetGroups: [frontendTg],
        certificates: [
          {
            certificateArn:
              // must be in region of stack
              siteConfig.siteCertificateArn,
          },
        ],
      });
      httpsListener.connections.allowDefaultPortFromAnyIpv4(
        "Open to the world"
      );
      actions.forEach((action, i) =>
        httpsListener.addAction(`HTTPSRule${i}`, action)
      );
    }

    this.backendTargetGroup = backendTg;
    this.frontendTargetGroup = frontendTg;
    this.iframelyTargetGroup = iframelyTg;
    this.alb = lb;
  }
}
