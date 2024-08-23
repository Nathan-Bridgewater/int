import * as cdk from "aws-cdk-lib";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as appsync from "aws-cdk-lib/aws-appsync";
import * as ddb from "aws-cdk-lib/aws-dynamodb";
import * as waf from "aws-cdk-lib/aws-wafv2"
import { Construct } from 'constructs';


export class InterviewStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "MyVpc", {
      vpcName: "my-vpc"
    })

    const cluster = new ecs.Cluster(this, "MyCluster", {
      vpc: vpc
    })

    const api = new appsync.GraphqlApi(this, 'MyApi', {
      name: "grahql-api",
      schema: appsync.SchemaFile.fromAsset("./schema/schema.graphql")
    })

    const cfnIpSet = new waf.CfnIPSet(this, 'MyIpSet', {
      name: 'my-ip',
      addresses: ['90.214.204.90/32'],
      scope: 'REGIONAL',
      ipAddressVersion: 'IPV4'
    })

    // const cfnWebAcl = new waf.CfnWebACL(this, 'MyWebAcl', {
    //   name: 'graphql-webacl',
    //   defaultAction: {
    //     block: {}
    //   },
    //   scope: 'REGIONAL',
    //   visibilityConfig: {
    //     cloudWatchMetricsEnabled: true,
    //     metricName: "graphql-webacl-metric",
    //     sampledRequestsEnabled: true
    //   },
    //   rules: [
    //     {
    //       name: 'CRSRule',
    //       priority: 0,
    //       statement: {
    //         managedRuleGroupStatement: {
    //           name: 'AWSManagedRulesCommonRuleSet',
    //           vendorName: 'AWS'
    //         }
    //       },
    //       visibilityConfig: {
    //         cloudWatchMetricsEnabled: true,
    //         metricName: 'graphql-webacl-metric-crs',
    //         sampledRequestsEnabled: true
    //       },
    //       overrideAction: {
    //         none: {}
    //       }
    //     },
    //     {
    //       name: 'IpCustomRule',
    //       priority: 1,
    //       statement: {
    //         ipSetReferenceStatement: {
    //           arn: cfnIpSet.attrArn
    //         },
    //       },
    //       visibilityConfig: {
    //         cloudWatchMetricsEnabled: true,
    //         metricName: 'graphql-webacl-metric-ip',
    //         sampledRequestsEnabled: true
    //       },
    //       overrideAction: {
    //           none: {}
    //         }

    //     }
    // ]
    // })

    // const cfnWebAclAssociation = new waf.CfnWebACLAssociation(this, 'MyWebAclAssociation', {
    //   resourceArn: api.arn,
    //   webAclArn: cfnWebAcl.attrArn
    // })

    const dynamodb = new ddb.Table(this, 'MyDdb', {
      partitionKey: {
        name: "id",
        type: ddb.AttributeType.STRING
      }
    })

    const add_func = new appsync.AppsyncFunction(this, 'func-get-post', {
      name: 'get_posts_func_1',
      api,
      dataSource: api.addDynamoDbDataSource('table-for-posts', dynamodb),
      code: appsync.Code.fromInline(`
          export function request(ctx) {
          return { operation: 'Scan' };
          }

          export function response(ctx) {
          return ctx.result.items;
          }
      `),
      runtime: appsync.FunctionRuntime.JS_1_0_0,
    });

      // Creates a function for mutation
      const add_func_2 = new appsync.AppsyncFunction(this, 'func-add-post', {
        name: 'add_posts_func_1',
        api,
        dataSource: api.addDynamoDbDataSource('table-for-posts-2', dynamodb),
        code: appsync.Code.fromInline(`
            export function request(ctx) {
              return {
              operation: 'PutItem',
              key: util.dynamodb.toMapValues({id: util.autoId()}),
              attributeValues: util.dynamodb.toMapValues(ctx.args.input),
              };
            }

            export function response(ctx) {
              return ctx.result;
            }
        `),
        runtime: appsync.FunctionRuntime.JS_1_0_0,
      });

      // Adds a pipeline resolver with the get function
      new appsync.Resolver(this, 'pipeline-resolver-get-posts', {
        api,
        typeName: 'Query',
        fieldName: 'getPost',
        code: appsync.Code.fromInline(`
            export function request(ctx) {
            return {};
            }

            export function response(ctx) {
            return ctx.prev.result;
            }
        `)  ,
        runtime: appsync.FunctionRuntime.JS_1_0_0,
        pipelineConfig: [add_func],
      });

      // Adds a pipeline resolver with the create function
      new appsync.Resolver(this, 'pipeline-resolver-create-posts', {
        api,
        typeName: 'Mutation',
        fieldName: 'createPost',
        code: appsync.Code.fromInline(`
            export function request(ctx) {
            return {};
            }

            export function response(ctx) {
            return ctx.prev.result;
            }
        `)  ,
        runtime: appsync.FunctionRuntime.JS_1_0_0,
        pipelineConfig: [add_func_2],
      });


    // Prints out URL
    new cdk.CfnOutput(this, "GraphQLAPIURL", {
      value: api.graphqlUrl
    });

    // Prints out the AppSync GraphQL API key to the terminal
    new cdk.CfnOutput(this, "GraphQLAPIKey", {
      value: api.apiKey || ''
    });

    // Prints out the stack region to the terminal
    new cdk.CfnOutput(this, "Stack Region", {
      value: this.region
    });

  }
}
