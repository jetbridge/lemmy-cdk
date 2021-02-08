// configuration for app

import { Peer } from "@aws-cdk/aws-ec2";
import * as path from "path";

// read config from .env and .env.local
require("dotenv-flow").config();

interface IConfig {
  SITE_DOMAIN_NAME: string;
  AWS_ACCOUNT: string;
  AWS_REGION: string;
  HTTPS_ENABLED: boolean;
  CERTIFICATE_ARN?: string;
  SSH_ALLOWED_HOSTS: string;
  BASTION_KEYPAIR_NAME?: string;
  LEMMY_DIR: string;
  LEMMY_UI_DIR: string;
  DB_SLEEP_HOURS?: string;
  DB_MAX_CAPACITY_ACU: string;
}

const env: IConfig = (process.env as unknown) as IConfig;
class SiteConfig {
  get awsAccount() {
    return env.AWS_ACCOUNT;
  }

  get awsRegion() {
    return env.AWS_REGION;
  }

  get httpsEnabled() {
    return !!env.HTTPS_ENABLED;
  }

  get siteCertificateArn() {
    return env.CERTIFICATE_ARN;
  }

  // e.g. federation.dev
  get siteDomainName() {
    return env.SITE_DOMAIN_NAME;
  }

  // e.g. www.federation.dev
  get webDomain() {
    return `www.${this.siteDomainName}`;
  }

  get sshAllowedHosts() {
    return [Peer.ipv4(env.SSH_ALLOWED_HOSTS)];
  }

  get bastionKeypairName() {
    return env.BASTION_KEYPAIR_NAME;
  }

  get cdkRootDir() {
    return path.join(__dirname, "..");
  }

  get lemmyDir() {
    return path.join(this.cdkRootDir, env.LEMMY_DIR);
  }

  get lemmyUiDir() {
    return path.join(this.cdkRootDir, env.LEMMY_UI_DIR);
  }

  get dbSleepHours() {
    return parseInt(env.DB_SLEEP_HOURS || "0");
  }

  get dbMaxCapacity() {
    return parseInt(env.DB_MAX_CAPACITY_ACU || "2");
  }
}

export const siteConfig = new SiteConfig();
