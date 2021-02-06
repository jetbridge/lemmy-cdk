// configuration for app

import { Peer } from "@aws-cdk/aws-ec2";

class SiteConfig {
  get siteCertificateArn() {
    // *.federation.dev
    return "arn:aws:acm:us-east-1:450542611688:certificate/77f30d77-57c8-4d4a-8b56-34ad892d4ba2";
  }

  get sshAllowedHosts() {
    return [Peer.ipv4("95.67.0.0/16")];
  }

  get bastionKeypairName() {
    return "fedev-ore-2020";
  }

  get siteDomainName() {
    return "federation.dev";
  }
}

export const siteConfig = new SiteConfig();
