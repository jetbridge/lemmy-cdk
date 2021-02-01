import {
  BastionHostLinux,
  CfnEIP,
  Peer,
  SecurityGroup,
  SubnetType,
  Vpc,
} from "@aws-cdk/aws-ec2";
import * as core from "@aws-cdk/core";

interface IBastionProps {
  vpc: Vpc;
}

export class Bastion extends core.Construct {
  securityGroup: SecurityGroup;
  elasticIp: CfnEIP;

  constructor(scope: core.Construct, id: string, { vpc }: IBastionProps) {
    super(scope, id);

    const securityGroup = new SecurityGroup(this, "SecGroup", {
      vpc,
      securityGroupName: "Bastion",
    });
    this.securityGroup = securityGroup;

    const host = new BastionHostLinux(this, "Host", {
      vpc,
      securityGroup,
      subnetSelection: {
        subnetType: SubnetType.PUBLIC,
      },
    });

    this.elasticIp = new CfnEIP(this, "EIP", {
      domain: "vpc",
      instanceId: host.instanceId,
    });

    host.allowSshAccessFrom(Peer.ipv4("95.67.0.0/16")); // TODO: config
    host.instance.instance.keyName = "fedev-ore-2020"; // TODO: config
  }
}
