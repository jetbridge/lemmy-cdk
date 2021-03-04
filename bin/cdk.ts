#!/usr/bin/env node
import * as cdk from "@aws-cdk/core";
import "source-map-support/register";
import { siteConfig } from "../lib/config";
import { Stack } from "../lib/stack";

// const envStage = {
//   account: siteConfig.awsAccount,
//   region: siteConfig.awsRegion,
// };

const envProd = {
  account: siteConfig.awsAccount,
  region: siteConfig.awsRegion,
};

const app = new cdk.App();
new Stack(app, "Lemmy", { env: envProd });
