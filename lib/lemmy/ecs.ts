import { Port, SecurityGroup, Vpc } from "@aws-cdk/aws-ec2";
import * as ecs from "@aws-cdk/aws-ecs";
import { ServerlessCluster } from "@aws-cdk/aws-rds";
import { NamespaceType } from "@aws-cdk/aws-servicediscovery";
import * as core from "@aws-cdk/core";
import { FileSystem } from "@aws-cdk/aws-efs";
import { LemmyApp } from "./app";
import { IFramely, IFramelyLoadBalancer, IFRAMELY_PORT } from "./iframely";
import { LemmyLoadBalancer } from "./loadbalancer";
import { Pictrs, PICTRS_PORT } from "./pictrs";

export interface IECSProps {
  vpc: Vpc;
  lemmyLoadBalancer: LemmyLoadBalancer;
  iframelyLoadBalancer: IFramelyLoadBalancer;
  db: ServerlessCluster;
  dbSecurityGroup: SecurityGroup;
  fs: FileSystem;
}

export class LemmyECS extends core.Construct {
  constructor(scope: core.Construct, id: string, props: IECSProps) {
    super(scope, id);

    // ECS cluster
    const cluster = new ecs.Cluster(this, "Cluster", {
      vpc: props.vpc,
      clusterName: "lemmy",
    });

    // service discovery
    const namespace = cluster.addDefaultCloudMapNamespace({
      name: "lemmy",
      type: NamespaceType.DNS_PRIVATE,
    });

    const serviceProps = { ...props, cluster, namespace };

    // TODO: pack multiple definitions into one service?
    const lemmyApp = new LemmyApp(this, "LemmyApp", serviceProps);
    const iframely = new IFramely(this, "IFramely", {
      ...serviceProps,
      iframelyLoadBalancer: props.iframelyLoadBalancer,
    });
    const pictrs = new Pictrs(this, "Pictrs", {
      ...serviceProps,
      fs: props.fs,
    });

    pictrs.securityGroup.addIngressRule(
      lemmyApp.backendSecurityGroup,
      Port.tcp(PICTRS_PORT),
      "Allow backend to access pictrs"
    );
    iframely.securityGroup.addIngressRule(
      lemmyApp.backendSecurityGroup,
      Port.tcp(IFRAMELY_PORT),
      "Allow backend to access iframely"
    );
  }
}
