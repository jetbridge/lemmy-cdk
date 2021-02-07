import { SecurityGroup } from "@aws-cdk/aws-ec2";
import {
  Cluster,
  ContainerImage,
  FargatePlatformVersion,
  FargateService,
  FargateTaskDefinition,
  LogDriver,
  Protocol,
  Volume,
} from "@aws-cdk/aws-ecs";
import { FileSystem } from "@aws-cdk/aws-efs";
import { INamespace } from "@aws-cdk/aws-servicediscovery";
import * as core from "@aws-cdk/core";
import { IECSProps } from "./ecs";

interface IPictrsProps extends IECSProps {
  cluster: Cluster;
  namespace: INamespace;
  fs: FileSystem;
}

export const PICTRS_PORT = 8080;
export const PICTRS_NAME = "pictrs";
const PICTRS_IMAGE = "asonix/pictrs:v0.2.5-r0";

export class Pictrs extends core.Construct {
  securityGroup: SecurityGroup;

  constructor(
    scope: core.Construct,
    id: string,
    { vpc, cluster, namespace, lemmyLoadBalancer, fs }: IPictrsProps
  ) {
    super(scope, id);

    // create mount for file storage
    // const fsAccessPoint = fs.addAccessPoint("Pictrs", {
    // path: "/pictrs",
    // posixUser: { gid: "991", uid: "991" }, // https://git.asonix.dog/asonix/pict-rs/src/branch/main/docker/prod/Dockerfile.amd64
    // });
    // fsAccessPoint.
    const assetVolume: Volume = {
      efsVolumeConfiguration: {
        // fileSystemId: fsAccessPoint.fileSystem.fileSystemId,
        fileSystemId: fs.fileSystemId,
        // authorizationConfig: { accessPointId: fsAccessPoint.accessPointId },
        // transitEncryption: "ENABLED",
        // rootDirectory: "/pictrs",
      },
      name: "assets",
    };

    // ECS
    const taskDef = new FargateTaskDefinition(this, "Task", {
      cpu: 256,
      memoryLimitMiB: 512,
      volumes: [assetVolume],
    });
    const container = taskDef.addContainer("Container", {
      image: ContainerImage.fromRegistry(PICTRS_IMAGE),
      logging: LogDriver.awsLogs({ streamPrefix: PICTRS_NAME }),
      environment: { PICTRS_PATH: "/mnt/assets" },
    });
    // mount asset storage volume
    container.addMountPoints({
      sourceVolume: assetVolume.name,
      containerPath: "/mnt/assets",
      readOnly: false,
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

    // lemmyLB.pictrsTargetGroup.addTarget(service);
    fs.connections.allowDefaultPortFrom(
      secGroup,
      "Allow from Pictrs container"
    );

    this.securityGroup = secGroup;
  }
}
