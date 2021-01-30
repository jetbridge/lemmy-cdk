import { CfnSecurityGroupIngress } from "@aws-cdk/aws-ec2";
import {
  BaseService,
  ContainerImage,
  EnvironmentFile,
  FargateService,
  FargateTaskDefinition,
  ICluster,
  Protocol,
} from "@aws-cdk/aws-ecs";
import * as core from "@aws-cdk/core";
import { LemmyLoadBalancer } from "./loadbalancer";

export interface ILemmyServiceProps {
  lemmyLB: LemmyLoadBalancer;
  cluster: ICluster;
  dockerDirectory: string; // from root of project dir
  dockerFilePath?: string;
  containerPort: number;
  environment?: Record<string, string>;
  environmentFiles?: EnvironmentFile[];
}

export class LemmyService extends core.Construct {
  service: BaseService;

  constructor(
    scope: core.Construct,
    id: string,
    {
      lemmyLB,
      cluster,
      dockerDirectory,
      dockerFilePath,
      containerPort,
      environment,
      environmentFiles,
    }: ILemmyServiceProps
  ) {
    super(scope, id);

    const taskDef = new FargateTaskDefinition(this, "Task", {
      cpu: 256, // Default is 256
      memoryLimitMiB: 512,
    });

    const container = taskDef.addContainer("Container", {
      image: ContainerImage.fromAsset(
        __dirname + `../../../../${dockerDirectory}`,
        { file: dockerFilePath }
      ),
      environment,
      environmentFiles,
    });

    container.addPortMappings({
      containerPort: containerPort,
      protocol: Protocol.TCP,
    });
    const ecsService = new FargateService(this, "LemmyService", {
      cluster,
      assignPublicIp: true, // or false, whatever
      taskDefinition: taskDef,
    });

    this.service = ecsService;
  }
}
