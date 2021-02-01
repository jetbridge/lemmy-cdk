import { SecurityGroup, Vpc } from "@aws-cdk/aws-ec2";
import * as core from "@aws-cdk/core";
import * as rds from "@aws-cdk/aws-rds";

export const DB_NAME = "lemmy";

interface ILemmyAppProps {
  vpc: Vpc;
}

export class Database extends core.Construct {
  cluster: rds.ServerlessCluster;
  securityGroup: SecurityGroup;

  constructor(scope: core.Construct, id: string, { vpc }: ILemmyAppProps) {
    super(scope, id);

    this.securityGroup = new SecurityGroup(this, "DBSecurityGroup", {
      vpc,
      description: "Database ingress",
    });

    this.cluster = new rds.ServerlessCluster(this, "LemmyCluster", {
      engine: rds.DatabaseClusterEngine.AURORA_POSTGRESQL,
      parameterGroup: rds.ParameterGroup.fromParameterGroupName(
        this,
        "ParameterGroup",
        "default.aurora-postgresql10"
      ),
      defaultDatabaseName: DB_NAME,
      vpc,
      securityGroups: [this.securityGroup],
      clusterIdentifier: "lemmy",
      scaling: {
        minCapacity: 2,
        maxCapacity: 2,
        autoPause: core.Duration.hours(24),
      }, // DB goes to sleep after a day of inactivity
    });
  }
}
