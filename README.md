# Lemmy AWS CDK

[Lemmy](https://github.com/LemmyNet/lemmy) is a Reddit-style federated social network that speaks ActivityPub. It is written in Rust.

This contains the necessary infrastructure definitions to deploy [Lemmy](https://github.com/LemmyNet/lemmy) to AWS. Feel free to customize!


### Included:

* ECS fargate cluster
  * Lemmy-UI
  * Lemmy
  * Pictrs
  * IFramely
* CloudFront CDN
* EFS storage for image uploads
* Aurora Serverless Postgres DB
* Bastion VPC host
* Load balancers for Lemmy and IFramely
* DNS records for your site

## Quickstart

Clone [Lemmy](https://github.com/LemmyNet/lemmy) and [Lemmy-UI](https://github.com/LemmyNet/lemmy-ui) to the directory above this.

```shell
cp example.env.local .env.local
# edit .env.local
```

You should edit .env.local with your site settings.

```shell
npm install
cdk deploy
```

## Useful CDK commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template
