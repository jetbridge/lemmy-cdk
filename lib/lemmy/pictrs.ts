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
import { FileSystem, LifecyclePolicy, PerformanceMode } from "@aws-cdk/aws-efs";
import { INamespace } from "@aws-cdk/aws-servicediscovery";
import * as core from "@aws-cdk/core";
import { IECSProps } from "./ecs";

interface IPictrsProps extends IECSProps {
  cluster: Cluster;
  namespace: INamespace;
}

export const PICTRS_PORT = 8080;
export const PICTRS_NAME = "pictrs";
const PICTRS_IMAGE = "asonix/pictrs:v0.2.5-r0";

export class Pictrs extends core.Construct {
  securityGroup: SecurityGroup;
  efs: FileSystem;

  constructor(
    scope: core.Construct,
    id: string,
    { vpc, cluster, namespace, lemmyLB }: IPictrsProps
  ) {
    super(scope, id);

    // EFS - storage for files
    const efs = new FileSystem(this, "FS", {
      vpc,
      encrypted: true, // file system is not encrypted by default
      lifecyclePolicy: LifecyclePolicy.AFTER_60_DAYS, // files are not transitioned to infrequent access (IA) storage by default
      performanceMode: PerformanceMode.GENERAL_PURPOSE, // default
    });

    // ECS
    const taskDef = new FargateTaskDefinition(this, "Task", {
      cpu: 256,
      memoryLimitMiB: 512,
      volumes: [
        // mount storage
        {
          efsVolumeConfiguration: {
            fileSystemId: efs.fileSystemId,
            rootDirectory: "/mnt",
          },
          name: "assets",
        },
      ],
    });

    const container = taskDef.addContainer("Container", {
      image: ContainerImage.fromRegistry(PICTRS_IMAGE),
      logging: LogDriver.awsLogs({ streamPrefix: PICTRS_NAME }),
    });
    // map port
    container.addPortMappings({
      containerPort: PICTRS_PORT,
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
      serviceName: `${PICTRS_NAME}-v2`,
      cloudMapOptions: { cloudMapNamespace: namespace, name: PICTRS_NAME },
      securityGroups: [secGroup],
      // temp for testing to speed up deployments
      minHealthyPercent: 0,
      maxHealthyPercent: 0,
    });

    lemmyLB.pictrsTargetGroup.addTarget(service);
    efs.connections.allowDefaultPortFrom(
      service,
      "Allow from Pictrs container"
    );

    this.efs = efs;
    this.securityGroup = secGroup;
  }
}
