import {
  ContainerDefinition,
  ContainerImage,
  LogDriver,
  Protocol,
  TaskDefinition,
} from "@aws-cdk/aws-ecs";
import { ServerlessCluster } from "@aws-cdk/aws-rds";
import { Secret } from "@aws-cdk/aws-secretsmanager";
import * as core from "@aws-cdk/core";
import { siteConfig } from "../config";
import { DB_NAME } from "../database";
import { IFRAMELY_NAME, IFRAMELY_PORT } from "./iframely";
import { PICTRS_NAME, PICTRS_PORT } from "./pictrs";

interface ILemmyAppProps {
  taskDef: TaskDefinition;
  db: ServerlessCluster;
}

export const BACKEND_PORT = 8536;
export const BACKEND_NAME = "lemmy";

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

export class LemmyBackend extends core.Construct {
  backendContainer: ContainerDefinition;

  constructor(
    scope: core.Construct,
    id: string,
    { taskDef, db }: ILemmyAppProps
  ) {
    super(scope, id);
    // generate a JWT secret key
    const appSecrets = new Secret(this, "AppSecret", {
      generateSecretString: {
        passwordLength: 30,
        generateStringKey: "jwt",
        secretStringTemplate: JSON.stringify({ jwt: "" }),
      },
    });

    const backendContainer = taskDef.addContainer(BACKEND_NAME, {
      image: ContainerImage.fromAsset(siteConfig.lemmyDir),
      essential: true,
      environment: {
        // provide secrets
        LEMMY_DATABASE_URL: makeDatabaseUrl(db),
        LEMMY_JWT_SECRET: appSecrets.secretValueFromJson("jwt").toString(),
        // lemmy config
        LEMMY_HOSTNAME: siteConfig.siteDomainName,
        LEMMY_EXTERNAL_HOST: siteConfig.siteDomainName,
        LEMMY_PICTRS_URL: `http://localhost:${PICTRS_PORT}`,
        LEMMY_IFRAMELY_URL: `http://localhost:${IFRAMELY_PORT}`,
        LEMMY__RATE_LIMIT__IMAGE: "30",
        RUST_BACKTRACE: "full",
        RUST_LOG: "debug",
      },
      logging: LogDriver.awsLogs({ streamPrefix: "backend" }),
    });
    // map port
    backendContainer.addPortMappings({
      containerPort: BACKEND_PORT,
      protocol: Protocol.TCP,
    });
  }
}
