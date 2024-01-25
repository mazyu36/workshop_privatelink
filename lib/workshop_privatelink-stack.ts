import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ConsumerConstruct } from './construct/consumer';
import { ServiceConstruct } from './construct/service';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class WorkshopPrivatelinkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);


    const serviceConstruct = new ServiceConstruct(this, 'ServiceConstruct', {})

    new ConsumerConstruct(this, 'ConsumerConstruct', {
      vpcEndpointService: serviceConstruct.vpcEndpointService
    })
  }
}
