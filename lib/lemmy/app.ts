import { Port, SecurityGroup } from "@aws-cdk/aws-ec2";
import {
  Cluster,
  ContainerImage,
  FargatePlatformVersion,
  FargateService,
  FargateTaskDefinition,
  LogDriver,
  Protocol,
} from "@aws-cdk/aws-ecs";
import { ServerlessCluster } from "@aws-cdk/aws-rds";
import { Secret } from "@aws-cdk/aws-secretsmanager";
import { INamespace } from "@aws-cdk/aws-servicediscovery";
import * as core from "@aws-cdk/core";
import { siteConfig } from "../config";
import { DB_NAME } from "../database";
import { IECSProps } from "./ecs";
import { IFRAMELY_NAME, IFRAMELY_PORT } from "./iframely";
import { PICTRS_NAME, PICTRS_PORT } from "./pictrs";

interface ILemmyAppProps extends IECSProps {
  cluster: Cluster;
  namespace: INamespace;
}

const BACKEND_PORT = 8536;
const FRONTEND_PORT = 1234;

/**
 * Create a database connection string
 */
const makeDatabaseUrl = (db: ServerlessCluster) => {
  const dbUsername = db.secret?.secretValueFromJson("username");
  const dbPassword = db.secret?.secretValueFromJson("password");

  return [
    "postgresql:/",
    `${dbUsername}:${dbPassword}@${db.clusterEndpoint.hostname}`,
    DB_NAME,
  ].join("/");
};

// TODO: split up backend and frontend
/**
 * Define backend and frontend tasks
 */
export class LemmyApp extends core.Construct {
  backendSecurityGroup: SecurityGroup;

  constructor(
    scope: core.Construct,
    id: string,
    {
      lemmyLoadBalancer,
      vpc,
      dbSecurityGroup,
      db,
      cluster,
      namespace,
    }: ILemmyAppProps
  ) {
    super(scope, id);

    const serviceDefaults = { cluster, namespace };

    // -- BACKEND --
    // generate a JWT secret key
    const appSecrets = new Secret(this, "AppSecret", {
      generateSecretString: {
        passwordLength: 30,
        generateStringKey: "jwt",
        secretStringTemplate: JSON.stringify({ jwt: "" }),
      },
    });

    // path to

    // ECS
    const backendTaskDef = new FargateTaskDefinition(this, "BackendTask", {
      cpu: 256,
      memoryLimitMiB: 512,
    });

    const backendContainer = backendTaskDef.addContainer("BackendContainer", {
      image: ContainerImage.fromAsset(siteConfig.lemmyDir),
      environment: {
        // provide secrets
        LEMMY_DATABASE_URL: makeDatabaseUrl(db),
        LEMMY_JWT_SECRET: appSecrets.secretValueFromJson("jwt").toString(),
        // lemmy config (TODO: move)
        LEMMY_HOSTNAME: siteConfig.siteDomainName,
        LEMMY_EXTERNAL_HOST: siteConfig.siteDomainName,
        LEMMY_PICTRS_URL: `http://${PICTRS_NAME}.${namespace.namespaceName}:${PICTRS_PORT}`,
        LEMMY_IFRAMELY_URL: `http://${IFRAMELY_NAME}.${namespace.namespaceName}:${IFRAMELY_PORT}`,
        LEMMY__RATE_LIMIT__IMAGE: "30",
        RUST_BACKTRACE: "full",
        RUST_LOG: "debug",
      },
      // environmentFiles: [EnvironmentFile.fromAsset(BACKEND_ENV)],
      logging: LogDriver.awsLogs({ streamPrefix: "backend" }),
    });
    // map port
    backendContainer.addPortMappings({
      containerPort: BACKEND_PORT,
      protocol: Protocol.TCP,
    });
    // service
    const backendSecGroup = new SecurityGroup(this, "BackendSecGroup", { vpc });
    const backendService = new FargateService(this, "BackendService", {
      ...serviceDefaults,
      assignPublicIp: true, // or false, whatever
      taskDefinition: backendTaskDef,
      platformVersion: FargatePlatformVersion.VERSION1_4,
      desiredCount: 1,
      serviceName: `backend`,
      cloudMapOptions: { cloudMapNamespace: namespace, name: "backend" },
      securityGroups: [backendSecGroup],
    });
    lemmyLoadBalancer.backendTargetGroup.addTarget(backendService);
    // allow backend to talk to DB
    dbSecurityGroup.addIngressRule(backendSecGroup, Port.tcp(5432));

    // -- FRONTEND --
    // ECS
    const frontendTaskDef = new FargateTaskDefinition(this, "FrontendTask", {
      cpu: 256,
      memoryLimitMiB: 512,
    });
    const frontendContainer = frontendTaskDef.addContainer(
      "FrontendContainer",
      {
        image: ContainerImage.fromAsset(siteConfig.lemmyUiDir),
        environment: {
          LEMMY_INTERNAL_HOST: `backend.${namespace.namespaceName}:${BACKEND_PORT}`,
          LEMMY_EXTERNAL_HOST: siteConfig.siteDomainName,
          LEMMY_WS_HOST: `api.${siteConfig.siteDomainName}`,
          LEMMY_HTTPS: "true",
        },
        // environmentFiles: [EnvironmentFile.fromAsset(FRONTEND_ENV)],
        logging: LogDriver.awsLogs({ streamPrefix: "frontend" }),
      }
    );
    // map port
    frontendContainer.addPortMappings({
      containerPort: FRONTEND_PORT,
      protocol: Protocol.TCP,
    });
    // service
    const frontendSecGroup = new SecurityGroup(this, "FrontendSecGroup", {
      vpc,
    });
    const frontendService = new FargateService(this, "FrontendService", {
      ...serviceDefaults,
      assignPublicIp: true, // or false, whatever
      taskDefinition: frontendTaskDef,
      platformVersion: FargatePlatformVersion.VERSION1_4,
      desiredCount: 1,
      serviceName: `frontend`,
      cloudMapOptions: { cloudMapNamespace: namespace, name: "frontend" },
      securityGroups: [frontendSecGroup],
    });
    lemmyLoadBalancer.frontendTargetGroup.addTarget(frontendService);

    // allow frontend to talk to backend
    backendSecGroup.addIngressRule(
      frontendSecGroup,
      Port.tcp(BACKEND_PORT),
      "Allow frontend to access backend"
    );

    this.backendSecurityGroup = backendSecGroup;
  }
}
