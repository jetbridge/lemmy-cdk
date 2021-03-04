import { Port, SecurityGroup, Vpc } from "@aws-cdk/aws-ec2";
import * as ecs from "@aws-cdk/aws-ecs";
import { ServerlessCluster } from "@aws-cdk/aws-rds";
import { NamespaceType } from "@aws-cdk/aws-servicediscovery";
import * as core from "@aws-cdk/core";
import { FileSystem } from "@aws-cdk/aws-efs";
import { LemmyFrontend } from "./frontend";
import { IFramely, IFRAMELY_PORT } from "./iframely";
import { LemmyLoadBalancer } from "./loadbalancer";
import { Pictrs, PICTRS_PORT } from "./pictrs";
import {
  FargatePlatformVersion,
  FargateService,
  Volume,
  FargateTaskDefinition,
} from "@aws-cdk/aws-ecs";
import { LemmyBackend } from "./backend";

export interface IECSProps {
  vpc: Vpc;
  lemmyLoadBalancer: LemmyLoadBalancer;
  db: ServerlessCluster;
  dbSecurityGroup: SecurityGroup;
  fs: FileSystem;
}

export class LemmyECS extends core.Construct {
  constructor(
    scope: core.Construct,
    id: string,
    { vpc, fs, db, lemmyLoadBalancer, dbSecurityGroup }: IECSProps
  ) {
    super(scope, id);

    // ECS cluster
    const cluster = new ecs.Cluster(this, "Cluster", {
      vpc: vpc,
      clusterName: "lemmy",
    });

    // service discovery
    const namespace = cluster.addDefaultCloudMapNamespace({
      name: "lemmy",
      type: NamespaceType.DNS_PRIVATE,
    });

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

    // task definition
    const taskDef = new FargateTaskDefinition(this, "Task", {
      cpu: 256,
      memoryLimitMiB: 512,
      volumes: [assetVolume],
    });

    // containers
    new LemmyFrontend(this, "LemmyFrontend", { taskDef });
    new LemmyBackend(this, "LemmyBackend", { taskDef, db });
    new IFramely(this, "IFramely", { taskDef });
    new Pictrs(this, "Pictrs", { taskDef, assetVolume });

    // service
    const secGroup = new SecurityGroup(this, "SecGroup", { vpc });
    const lemmyService = new FargateService(this, "BackendService", {
      cluster,
      // namespace,
      assignPublicIp: true, // or false, whatever
      taskDefinition: taskDef,
      platformVersion: FargatePlatformVersion.VERSION1_4,
      desiredCount: 1,
      serviceName: `lemmy`,
      // cloudMapOptions: { cloudMapNamespace: namespace, name: "lemmy" },
      securityGroups: [secGroup],
    });
    lemmyService.registerLoadBalancerTargets;

    // all target groups point at our ECS service, on different ports
    const a = lemmyLoadBalancer.frontendTargetGroup.addTarget(lemmyService);
    lemmyLoadBalancer.backendTargetGroup.addTarget(lemmyService);
    lemmyLoadBalancer.iframelyTargetGroup.addTarget(lemmyService);

    // security group allow
    fs.connections.allowDefaultPortFrom(
      secGroup,
      "Allow from Pictrs container"
    );
    dbSecurityGroup.addIngressRule(secGroup, Port.tcp(5432));
  }
}
