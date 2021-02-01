import { Port, SecurityGroup, Vpc } from "@aws-cdk/aws-ec2";
import * as ecs from "@aws-cdk/aws-ecs";
import { ServerlessCluster } from "@aws-cdk/aws-rds";
import { NamespaceType } from "@aws-cdk/aws-servicediscovery";
import * as core from "@aws-cdk/core";
import { LemmyApp } from "./app";
import { IFramely, IFRAMELY_PORT } from "./iframely";
import { LemmyLoadBalancer } from "./loadbalancer";
import { Pictrs, PICTRS_PORT } from "./pictrs";

export interface IECSProps {
  vpc: Vpc;
  lemmyLB: LemmyLoadBalancer;
  db: ServerlessCluster;
  dbSecurityGroup: SecurityGroup;
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

    const lemmyApp = new LemmyApp(this, "LemmyApp", serviceProps);
    const pictrs = new Pictrs(this, "Pictrs", serviceProps);
    const iframely = new IFramely(this, "IFramely", serviceProps);

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
