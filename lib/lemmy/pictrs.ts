import { SecurityGroup } from "@aws-cdk/aws-ec2";
import {
  ContainerImage,
  LogDriver,
  Protocol,
  TaskDefinition,
  Volume,
} from "@aws-cdk/aws-ecs";
import * as core from "@aws-cdk/core";

interface IPictrsProps {
  taskDef: TaskDefinition;
  assetVolume: Volume;
}

export const PICTRS_PORT = 8080;
export const PICTRS_NAME = "pictrs";
const PICTRS_IMAGE = "asonix/pictrs:v0.3.0-alpha.7-r0";

export class Pictrs extends core.Construct {
  securityGroup: SecurityGroup;

  constructor(
    scope: core.Construct,
    id: string,
    { taskDef, assetVolume }: IPictrsProps
  ) {
    super(scope, id);

    const container = taskDef.addContainer(PICTRS_NAME, {
      image: ContainerImage.fromRegistry(PICTRS_IMAGE),
      logging: LogDriver.awsLogs({ streamPrefix: PICTRS_NAME }),
      environment: { PICTRS_PATH: "/mnt/assets" },
      command: ["/usr/local/bin/pict-rs"],
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
  }
}
