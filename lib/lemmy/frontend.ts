import { SecurityGroup } from "@aws-cdk/aws-ec2";
import {
  ContainerImage,
  LogDriver,
  Protocol,
  TaskDefinition,
} from "@aws-cdk/aws-ecs";
import * as core from "@aws-cdk/core";
import { siteConfig } from "../config";
import { BACKEND_NAME, BACKEND_PORT } from "./backend";

interface ILemmyFrontendProps {
  taskDef: TaskDefinition;
}

export const FRONTEND_PORT = 1234;
export const FRONTEND_NAME = "lemmy-ui";

export class LemmyFrontend extends core.Construct {
  backendContainer: SecurityGroup;

  constructor(
    scope: core.Construct,
    id: string,
    { taskDef }: ILemmyFrontendProps
  ) {
    super(scope, id);

    const frontendContainer = taskDef.addContainer(FRONTEND_NAME, {
      essential: true,
      image: ContainerImage.fromAsset(siteConfig.lemmyUiDir),
      environment: {
        LEMMY_INTERNAL_HOST: `localhost:${BACKEND_PORT}`,
        LEMMY_EXTERNAL_HOST: siteConfig.siteDomainName,
        LEMMY_WS_HOST: `api.${siteConfig.siteDomainName}`,
        LEMMY_HTTPS: "true",
      },
      logging: LogDriver.awsLogs({ streamPrefix: "frontend" }),
    });
    // map port
    frontendContainer.addPortMappings({
      containerPort: FRONTEND_PORT,
      protocol: Protocol.TCP,
    });
  }
}
