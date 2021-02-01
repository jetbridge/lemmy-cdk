#!/usr/bin/env node
import * as cdk from "@aws-cdk/core";
import "source-map-support/register";
import { Stack } from "../lib/stack";

const envProd = { account: "450542611688", region: "us-west-2" };

const app = new cdk.App();
new Stack(app, "Lemmy", { env: envProd });
