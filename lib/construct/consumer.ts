import { Construct } from 'constructs';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';

export interface ConsumerConstructProps {
  vpcEndpointService: ec2.VpcEndpointService
}

export class ConsumerConstruct extends Construct {

  public readonly consumerVpc: ec2.Vpc
  constructor(scope: Construct, id: string, props: ConsumerConstructProps) {
    super(scope, id);

    // ------ Consumer VPC -------
    const consumerVpc = new ec2.Vpc(this, 'ConsumerVpc', {
      ipAddresses: ec2.IpAddresses.cidr('10.1.0.0/16'),
      natGateways: 0,
      maxAzs: 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'PrivateSubnet',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        }
      ],
      enableDnsHostnames: true,
      enableDnsSupport: true
    }
    )
    this.consumerVpc = consumerVpc

    consumerVpc.addInterfaceEndpoint("SSMEndpoint", {
      service: ec2.InterfaceVpcEndpointAwsService.SSM,
    });
    consumerVpc.addInterfaceEndpoint("SSMMessagesEndpoint", {
      service: ec2.InterfaceVpcEndpointAwsService.SSM_MESSAGES,
    });
    consumerVpc.addInterfaceEndpoint("EC2MessagesEndpoint", {
      service: ec2.InterfaceVpcEndpointAwsService.EC2_MESSAGES,
    });


    new ec2.Instance(this, 'ConsumerInstance', {
      vpc: consumerVpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: new ec2.AmazonLinuxImage({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2023,
        cpuType: ec2.AmazonLinuxCpuType.X86_64
      }),
      vpcSubnets: consumerVpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }),
      ssmSessionPermissions: true
    });

    const vpcEndpoint = new ec2.InterfaceVpcEndpoint(this, 'VpcEndpoint', {
      service: new ec2.InterfaceVpcEndpointService(props.vpcEndpointService.vpcEndpointServiceName),
      vpc: consumerVpc,
      subnets: consumerVpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      )

    })

    vpcEndpoint.connections.allowFromAnyIpv4(ec2.Port.tcp(80))

  }
}