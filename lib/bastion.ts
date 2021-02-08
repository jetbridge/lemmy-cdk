import {
  BastionHostLinux,
  CfnEIP,
  Peer,
  SecurityGroup,
  SubnetType,
  Vpc,
} from "@aws-cdk/aws-ec2";
import * as core from "@aws-cdk/core";
import { siteConfig } from "./config";

interface IBastionProps {
  vpc: Vpc;
}

// Optional EC2 host to provide an entrypoint into the VPC
// useful for accessing the database
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

    siteConfig.sshAllowedHosts.map((peer) => host.allowSshAccessFrom(peer));
    host.instance.instance.keyName = siteConfig.bastionKeypairName;
  }
}
