import { SecurityGroup, Vpc } from "@aws-cdk/aws-ec2";
import {
  Cluster,
  ContainerImage,
  FargatePlatformVersion,
  FargateService,
  FargateTaskDefinition,
  LogDriver,
  Protocol,
} from "@aws-cdk/aws-ecs";
import {
  ApplicationLoadBalancer,
  ApplicationProtocol,
  ApplicationTargetGroup,
  IpAddressType,
  ListenerAction,
  TargetType,
} from "@aws-cdk/aws-elasticloadbalancingv2";
import { INamespace } from "@aws-cdk/aws-servicediscovery";
import * as core from "@aws-cdk/core";
import { Duration } from "@aws-cdk/core";
import { IECSProps } from "./ecs";

interface ILBProps {
  vpc: Vpc;
}

export class IFramelyLoadBalancer extends core.Construct {
  iframelyTargetGroup: ApplicationTargetGroup;
  alb: ApplicationLoadBalancer;

  constructor(scope: core.Construct, id: string, { vpc }: ILBProps) {
    super(scope, id);

    // ALB
    const lb = new ApplicationLoadBalancer(this, "IFramelyLB", {
      vpc,
      internetFacing: true,
      http2Enabled: true,
      ipAddressType: IpAddressType.IPV4, // dual-stack would be nice, not super easy to do yet
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

    const httpListener = lb.addListener("IFramelyHTTPListener", {
      protocol: ApplicationProtocol.HTTP,
      open: true,
      defaultTargetGroups: [iframelyTg],
    });
    // TODO: limit to CF and internal services
    httpListener.connections.allowDefaultPortFromAnyIpv4("Open to the world");

    this.iframelyTargetGroup = iframelyTg;
    this.alb = lb;
  }
}
interface IIFramelyProps extends IECSProps {
  cluster: Cluster;
  namespace: INamespace;
  iframelyLoadBalancer: IFramelyLoadBalancer;
}

export const IFRAMELY_PORT = 8061;
export const IFRAMELY_IMAGE = "dogbin/iframely:latest";
export const IFRAMELY_NAME = "iframely";

export class IFramely extends core.Construct {
  securityGroup: SecurityGroup;

  constructor(
    scope: core.Construct,
    id: string,
    { vpc, cluster, namespace, iframelyLoadBalancer }: IIFramelyProps
  ) {
    super(scope, id);

    // ECS
    const taskDef = new FargateTaskDefinition(this, "Task", {
      cpu: 256,
      memoryLimitMiB: 512,
    });

    const container = taskDef.addContainer("Container", {
      image: ContainerImage.fromRegistry(IFRAMELY_IMAGE),
      logging: LogDriver.awsLogs({ streamPrefix: IFRAMELY_NAME }),
    });
    // map port
    container.addPortMappings({
      containerPort: IFRAMELY_PORT,
      protocol: Protocol.TCP,
    });
    // service
    const secGroup = new SecurityGroup(this, "SecGroup", { vpc });
    const service = new FargateService(this, "Service", {
      cluster,
      assignPublicIp: true,
      taskDefinition: taskDef,
      platformVersion: FargatePlatformVersion.VERSION1_4,
      desiredCount: 1,
      serviceName: `${IFRAMELY_NAME}-v1`,
      cloudMapOptions: { cloudMapNamespace: namespace, name: IFRAMELY_NAME },
      securityGroups: [secGroup],
      // temp for testing to speed up deployments
      minHealthyPercent: 0,
      maxHealthyPercent: 0,
    });

    iframelyLoadBalancer.iframelyTargetGroup.addTarget(service);

    this.securityGroup = secGroup;
  }
}
