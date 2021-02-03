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
import * as fs from "fs";
import { DB_NAME } from "../database";
import { IECSProps } from "./ecs";
import { IFRAMELY_NAME, IFRAMELY_PORT } from "./iframely";
import { PICTRS_NAME, PICTRS_PORT } from "./pictrs";

interface ILemmyAppProps extends IECSProps {
  cluster: Cluster;
  namespace: INamespace;
}

const CDK_ROOT = __dirname + `/../..`;
const BACKEND_ENV = `${CDK_ROOT}/backend.env`;
const FRONTEND_ENV = `${CDK_ROOT}/frontend.env`;

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
export class LemmyApp extends core.Construct {
  backendSecurityGroup: SecurityGroup;

  constructor(
    scope: core.Construct,
    id: string,
    { lemmyLB, vpc, dbSecurityGroup, db, cluster, namespace }: ILemmyAppProps
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

    // ensure lemmy config exists
    const lemmyDir = `${CDK_ROOT}/../lemmy`;
    // const confDir = `${lemmyDir}/config`;
    // const confPath = `${confDir}/config.hjson`;
    // if (!fs.existsSync(confDir)) fs.mkdirSync(confDir);
    // if (!fs.existsSync(confPath)) {
    //   const confFd = fs.openSync(confPath, "w");
    //   fs.writeSync(
    //     confFd,
    //     JSON.stringify({
    //       // defaults
    //       hostname: "localhost:8536",
    //     })
    //   );
    //   fs.closeSync(confFd);
    // }
    // TODO: ensure using cutomized dockerfile that copies config.hjson to /config/config.hjson

    // ECS
    const backendTaskDef = new FargateTaskDefinition(this, "BackendTask", {
      cpu: 256,
      memoryLimitMiB: 512,
    });

    const backendContainer = backendTaskDef.addContainer("BackendContainer", {
      image: ContainerImage.fromAsset(
        lemmyDir
        // { file: 'docker/prod' }
      ),
      environment: {
        // provide secrets
        LEMMY_DATABASE_URL: makeDatabaseUrl(db),
        LEMMY_JWT_SECRET: appSecrets.secretValueFromJson("jwt").toString(),
        // lemmy config (TODO: move)
        LEMMY_HOSTNAME: "federation.dev",
        LEMMY_EXTERNAL_HOST: "federation.dev",
        LEMMY_PICTRS_URL: `http://${PICTRS_NAME}.${namespace.namespaceName}:${PICTRS_PORT}`,
        LEMMY_IFRAMELY_URL: `http://${IFRAMELY_NAME}.${namespace.namespaceName}:${IFRAMELY_PORT}`,
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
      serviceName: `backend-v4`,
      cloudMapOptions: { cloudMapNamespace: namespace, name: "backend" },
      securityGroups: [backendSecGroup],
      // temp for testing to speed up deployments
      minHealthyPercent: 0,
      maxHealthyPercent: 0,
    });
    lemmyLB.backendTargetGroup.addTarget(backendService);
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
        image: ContainerImage.fromAsset(`${CDK_ROOT}/../ui`),
        environment: {
          LEMMY_INTERNAL_HOST: `backend.${namespace.namespaceName}:${BACKEND_PORT}`,
          LEMMY_EXTERNAL_HOST: "federation.dev",
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
      serviceName: `frontend-v4`,
      cloudMapOptions: { cloudMapNamespace: namespace, name: "frontend" },
      securityGroups: [frontendSecGroup],
      // temp for testing to speed up deployments
      minHealthyPercent: 0,
      maxHealthyPercent: 0,
    });
    lemmyLB.frontendTargetGroup.addTarget(frontendService);

    // allow frontend to talk to backend
    backendSecGroup.addIngressRule(
      frontendSecGroup,
      Port.tcp(BACKEND_PORT),
      "Allow frontend to access backend"
    );

    this.backendSecurityGroup = backendSecGroup;
  }
}
