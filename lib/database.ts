import { SecurityGroup, Vpc } from "@aws-cdk/aws-ec2";
import * as core from "@aws-cdk/core";
import * as rds from "@aws-cdk/aws-rds";

interface ILemmyAppProps {
  vpc: Vpc;
  securityGroup: SecurityGroup;
}

export class Database extends core.Construct {
  cluster: rds.ServerlessCluster;

  constructor(
    scope: core.Construct,
    id: string,
    { vpc, securityGroup }: ILemmyAppProps
  ) {
    super(scope, id);

    this.cluster = new rds.ServerlessCluster(this, "LemmyCluster", {
      engine: rds.DatabaseClusterEngine.AURORA_POSTGRESQL,
      parameterGroup: rds.ParameterGroup.fromParameterGroupName(
        this,
        "ParameterGroup",
        "default.aurora-postgresql10"
      ),
      defaultDatabaseName: "lemmy",
      vpc,
      securityGroups: [securityGroup],
      scaling: {
        minCapacity: 2,
        maxCapacity: 2,
        autoPause: core.Duration.hours(24),
      }, // DB goes to sleep after a day of inactivity
    });
  }
}
