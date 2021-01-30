# Lemmy AWS CDK
This contains the necessary infrastructure definitions to deploy Lemmy to AWS. Feel free to customize!

This generates an ECS Fargate cluster with an Application Load Balancer and service definitions.

# Quickstart
* Copy `docker/prod/Dockerfile` to the root of the `lemmy/` directory
* Create a `backend.env` file with your Lemmy environment configuration variables:
  ```env
  LEMMY_HOSTNAME=cursed.lool
  LEMMY__SETUP__SITE_NAME=My Lemmy
  LEMMY_HTTPS=true
  LEMMY_EXTERNAL_HOST=cursed.lol
  LEMMY_DATABASE_URL=postgresql:///foo
  LEMMY_JWT_SECRET=123
  ```
* And a `frontend.env` for your frontend config:
  ```env
  LEMMY_EXTERNAL_HOST=cursed.lol
  LEMMY_HTTPS=true
  ```
* ```
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
