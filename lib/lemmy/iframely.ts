import { SecurityGroup } from "@aws-cdk/aws-ec2";
import {
  Cluster,
  ContainerImage,
  FargatePlatformVersion,
  FargateService,
  FargateTaskDefinition,
  LogDriver,
  Protocol,
} from "@aws-cdk/aws-ecs";
import { INamespace } from "@aws-cdk/aws-servicediscovery";
import * as core from "@aws-cdk/core";
import { IECSProps } from "./ecs";

interface IIFramelyProps extends IECSProps {
  cluster: Cluster;
  namespace: INamespace;
}

export const IFRAMELY_PORT = 8061;
export const IFRAMELY_IMAGE = "dogbin/iframely:latest";
export const IFRAMELY_NAME = "iframely";

export class IFramely extends core.Construct {
  securityGroup: SecurityGroup;

  constructor(
    scope: core.Construct,
    id: string,
    { vpc, cluster, namespace, lemmyLB }: IIFramelyProps
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

    lemmyLB.iframelyTargetGroup.addTarget(service);

    this.securityGroup = secGroup;
  }
}
