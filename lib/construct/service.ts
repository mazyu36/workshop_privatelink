import { Construct } from 'constructs';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_elasticloadbalancingv2 as elbv2 } from 'aws-cdk-lib';
import { aws_elasticloadbalancingv2_targets as targets } from 'aws-cdk-lib';


export interface ServiceConstructProps {

}

export class ServiceConstruct extends Construct {
  public readonly serviceVpc: ec2.Vpc
  public readonly vpcEndpointService: ec2.VpcEndpointService
  constructor(scope: Construct, id: string, props: ServiceConstructProps) {
    super(scope, id);

    // ------ Service VPC -------
    const serviceVpc = new ec2.Vpc(this, 'ServiceVpc', {
      ipAddresses: ec2.IpAddresses.cidr('192.168.0.0/16'),
      natGateways: 2,
      maxAzs: 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'PublicSubnet',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'PrivateSubnet',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        }
      ],
      enableDnsHostnames: true,
      enableDnsSupport: true
    }
    )
    this.serviceVpc = serviceVpc


    const userData = ec2.UserData.forLinux({ shebang: '#!/bin/bash' })
    userData.addCommands(
      '#!/bin/bash',
      'dnf update -y',
      'dnf install -y httpd wget php-fpm php-mysqli php-json php php-devel',
      'dnf install -y mariadb105-server',
      'systemctl start httpd',
      'systemctl enable httpd',
      'usermod -a -G apache ec2-user',
      'chown -R ec2-user:apache /var/www',
      'chmod 2775 /var/www',
      'find /var/www -type d -exec chmod 2775 {} \;',
      'find /var/www -type f -exec chmod 0664 {} \;',
      'echo "<?php phpinfo(); ?>" > /var/www/html/phpinfo.php',
    )

    // EC2インスタンスを作成
    const ec2Instance = new ec2.Instance(this, 'ServiceInstance', {
      vpc: serviceVpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: new ec2.AmazonLinuxImage({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2023,
        cpuType: ec2.AmazonLinuxCpuType.X86_64
      }),
      userData: userData,
      vpcSubnets: serviceVpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }),
      ssmSessionPermissions: true
    });

    ec2Instance.connections.allowFromAnyIpv4(ec2.Port.tcp(80))


    // NLB
    const nlb = new elbv2.NetworkLoadBalancer(this, 'NLB', {
      vpc: serviceVpc,
      internetFacing: false,
      vpcSubnets: serviceVpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }),

    })

    nlb.connections.allowFromAnyIpv4(ec2.Port.tcp(80))

    const listener = nlb.addListener('Listener', {
      port: 80,
    })

    listener.addTargets('ServiceInstance', {
      port: 80,
      targets: [new targets.InstanceTarget(ec2Instance)],
      healthCheck: {
        path: '/phpinfo.php',
        protocol: elbv2.Protocol.HTTP,
        healthyHttpCodes: '200'
      }
    })


    // EndpointService
    const vpcEndpointService = new ec2.VpcEndpointService(this, 'VpcEndpointService', {
      vpcEndpointServiceLoadBalancers: [nlb],
      acceptanceRequired: true
    })
    this.vpcEndpointService = vpcEndpointService
  }
}