import { Port, SecurityGroup, Vpc } from "@aws-cdk/aws-ec2";
import * as ecs from "@aws-cdk/aws-ecs";
import { EnvironmentFile } from "@aws-cdk/aws-ecs";
import { ServerlessCluster } from "@aws-cdk/aws-rds";
import * as core from "@aws-cdk/core";
import { LemmyLoadBalancer } from "./loadbalancer";
import { LemmyService } from "./service-base";
import { Secret } from "@aws-cdk/aws-secretsmanager";

interface ILemmyAppProps {
  vpc: Vpc;
  lemmyLB: LemmyLoadBalancer;
  db: ServerlessCluster;
  dbSecurityGroup: SecurityGroup;
}

const CDK_ROOT = __dirname + `../../../`;
const BACKEND_ENV = `${CDK_ROOT}/backend.env`;
const FRONTEND_ENV = `${CDK_ROOT}/frontend.env`;

/**
 * Create a database connection string
 */
const makeDatabaseUrl = (db: ServerlessCluster) => {
  console.log("SEECRET", db.secret?.secretValue);
  const dbPassword = db.secret?.secretValueFromJson("password");

  return ["postgresql:", `admin:${dbPassword}@${db.clusterEndpoint}`].join("/");
};

export class LemmyApp extends core.Construct {
  constructor(
    scope: core.Construct,
    id: string,
    { lemmyLB, vpc, dbSecurityGroup, db }: ILemmyAppProps
  ) {
    super(scope, id);

    // ECS cluster
    const cluster = new ecs.Cluster(this, "LemmyCluster", {
      vpc: vpc,
    });

    // BACKEND
    // generate a JWT secret key
    const appSecrets = new Secret(this, "LemmyAppSecret", {
      generateSecretString: {
        passwordLength: 30,
        generateStringKey: "jwt",
        secretStringTemplate: JSON.stringify({ jwt: "" }),
      },
    });
    const backendService = new LemmyService(this, "LemmyBackendService", {
      lemmyLB,
      cluster,
      dockerDirectory: "lemmy",
      dockerFilePath: "docker/prod",
      containerPort: 8536,
      environmentFiles: [EnvironmentFile.fromAsset(BACKEND_ENV)],
      environment: {
        // provide secrets
        LEMMY_DATABASE_URL: makeDatabaseUrl(db),
        LEMMY_JWT_SECRET: appSecrets.secretValueFromJson("jwt").toString(),
      },
    });
    lemmyLB.backendTargetGroup.addTarget(backendService.service);
    // allow backend to talk to DB
    dbSecurityGroup.addIngressRule(
      backendService.service.connections.securityGroups[0],
      Port.tcp(5432)
    );

    // FRONTEND
    const frontendService = new LemmyService(this, "LemmyFrontendService", {
      lemmyLB,
      cluster,
      dockerDirectory: "ui",
      containerPort: 1234,
      environmentFiles: [EnvironmentFile.fromAsset(FRONTEND_ENV)],
      environment: {
        LEMMY_INTERNAL_HOST: `${backendService.service.serviceName}.lemmycluster.local:8536`,
      },
    });
    lemmyLB.frontendTargetGroup.addTarget(frontendService.service);

    // Create a load-balanced Fargate service and make it public
    // new ecs_patterns.ApplicationLoadBalancedFargateService(
    //   this,
    //   "LemmyAppService",
    //   {
    //     cluster: cluster, // Required
    //     cpu: 256, // Default is 256
    //     desiredCount: 1, // Default is 1
    //     taskImageOptions: {
    //       image: ecs.ContainerImage.fromAsset(
    //         __dirname + "../../../lemmy/docker/prod"
    //       ),
    //     },
    //     memoryLimitMiB: 512, // Default is 512
    //     publicLoadBalancer: true, // Default is false
    //     domainName: "federation.dev",
    //     domainZone: HostedZone.fromHostedZoneAttributes(this, "FedDevZone", {
    //       hostedZoneId: "Z0266198IOHWFCMZWF2",
    //       zoneName: "federation.dev",
    //     }),
    //     certificate: Certificate.fromCertificateArn(
    //       this,
    //       "FedDevCert",
    //       "arn:aws:acm:us-west-2:450542611688:certificate/68f4c06e-b71e-4c71-bd89-7ee5efc0233b"
    //     ),
    //   }
    // );
  }
}
