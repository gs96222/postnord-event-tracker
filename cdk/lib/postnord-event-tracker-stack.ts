import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as logs from 'aws-cdk-lib/aws-logs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import * as path from 'path';
import { getConfig } from './config';
import * as iam from 'aws-cdk-lib/aws-iam';

export class PostNordEventTrackerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const isProd = getConfig().environment === 'prod';

    // DynamoDB Table for Shipment Events
    const shipmentEventsTable = new dynamodb.Table(this, 'ShipmentEventsTable', {
      tableName: getConfig().tables.shipmentEventTable,
      partitionKey: {
        name: 'shipmentId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY, // easy deletion when stack deployed, change to retain for prod deployment
    });

    // Common Lambda environment variables
    const lambdaEnvironment = {
      SHIPMENT_EVENTS_TABLE: shipmentEventsTable.tableName,
      REGION: this.region,
      NODE_OPTIONS: '--enable-source-maps',
    };

    // Common Lambda props
    const commonLambdaProps = {
      runtime: lambda.Runtime.NODEJS_18_X,
      timeout: cdk.Duration.seconds(30),

      memorySize: isProd ? 256 : 128,
      environment: lambdaEnvironment,
      bundling: {
        externalModules: ['aws-sdk', '@aws-sdk/*'],
        minify: true,
        platform: 'linux/arm64', // Add this for Apple Silicon
        sourceMap: true,
        target: 'es2020',
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    };

    // Lambda Functions
    const recordEventFunction = new NodejsFunction(this, 'RecordEventFunction', {
      ...commonLambdaProps,
      functionName: 'postnord-record-event',
      entry: path.join(__dirname, '../../src/api/recordEvent.ts'),
      handler: 'handler',
      description: 'Records a new shipment event',
      projectRoot: path.join(__dirname, '../..'),
    });

    const getEventHistoryFunction = new NodejsFunction(this, 'GetEventHistoryFunction', {
      ...commonLambdaProps,
      functionName: 'postnord-get-event-history',
      entry: path.join(__dirname, '../../src/api/getEventHistory.ts'),
      handler: 'handler',
      description: 'Retrieves paginated event history for a shipment',
      projectRoot: path.join(__dirname, '../..'),
    });

    const getLatestEventFunction = new NodejsFunction(this, 'GetLatestEventFunction', {
      ...commonLambdaProps,
      functionName: 'postnord-get-latest-event',
      entry: path.join(__dirname, '../../src/api/getLatestEvent.ts'),
      handler: 'handler',
      description: 'Retrieves the latest event for a shipment',
      projectRoot: path.join(__dirname, '../..'),
    });

    // Grant DynamoDB permissions to Lambda functions
    shipmentEventsTable.grantReadWriteData(recordEventFunction);
    shipmentEventsTable.grantReadData(getEventHistoryFunction);
    shipmentEventsTable.grantReadData(getLatestEventFunction);

    // Add this before your API Gateway definition
    const apiGatewayCloudWatchRole = new iam.Role(this, 'ApiGatewayCloudWatchRole', {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AmazonAPIGatewayPushToCloudWatchLogs'
        ),
      ],
    });

    // Set the CloudWatch role for API Gateway account settings
    new apigateway.CfnAccount(this, 'ApiGatewayAccount', {
      cloudWatchRoleArn: apiGatewayCloudWatchRole.roleArn,
    });

    // API Gateway
    const api = new apigateway.RestApi(this, 'PostNordEventTrackerApi', {
      restApiName: 'PostNord Event Tracker API',
      description: 'API for managing PostNord shipment events',
      deployOptions: {
        stageName: 'prod',
        throttlingRateLimit: 100,
        throttlingBurstLimit: 200,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
      },
    });

    // API Gateway Resources and Methods
    const shipmentsResource = api.root.addResource('shipments');
    const shipmentResource = shipmentsResource.addResource('{shipmentId}');
    const eventsResource = shipmentResource.addResource('events');

    const recordEvenRequesttModel = new apigateway.Model(this, 'RecordEventModel', {
      restApi: api,
      contentType: 'application/json',
      modelName: 'RecordEventModel',
      schema: {
        type: apigateway.JsonSchemaType.OBJECT,
        required: ['timestamp', 'status'],
        properties: {
          timestamp: {
            type: apigateway.JsonSchemaType.STRING,
          },
          status: {
            type: apigateway.JsonSchemaType.STRING,
          },
          location: {
            type: apigateway.JsonSchemaType.STRING,
          },
          details: {
            type: apigateway.JsonSchemaType.STRING,
          },
        },
      },
    });

    const eventProperties = {
      id: { type: apigateway.JsonSchemaType.STRING },
      shipmentId: { type: apigateway.JsonSchemaType.STRING },
      timestamp: { type: apigateway.JsonSchemaType.STRING },
      status: { type: apigateway.JsonSchemaType.STRING },
      location: { type: apigateway.JsonSchemaType.STRING },
      details: { type: apigateway.JsonSchemaType.STRING },
      createdAt: { type: apigateway.JsonSchemaType.STRING },
    };

    const successResponseModel = new apigateway.Model(this, 'SuccessResponseModel', {
      restApi: api,
      contentType: 'application/json',
      modelName: 'SuccessResponseModel',
      schema: {
        type: apigateway.JsonSchemaType.OBJECT,
        required: ['success', 'data'],
        properties: {
          success: {
            type: apigateway.JsonSchemaType.BOOLEAN,
          },
          data: {
            type: apigateway.JsonSchemaType.OBJECT,
            properties: eventProperties,
          },
          message: {
            type: apigateway.JsonSchemaType.STRING,
          },
        },
      },
    });

    const paginatedResponseModel = new apigateway.Model(this, 'PaginatedResponseModel', {
      restApi: api,
      contentType: 'application/json',
      modelName: 'PaginatedResponseModel',
      schema: {
        type: apigateway.JsonSchemaType.OBJECT,
        required: ['success', 'data', 'pagination'],
        properties: {
          success: {
            type: apigateway.JsonSchemaType.BOOLEAN,
          },
          data: {
            type: apigateway.JsonSchemaType.ARRAY,
            items: {
              type: apigateway.JsonSchemaType.OBJECT,
              properties: eventProperties,
            },
          },
          pagination: {
            type: apigateway.JsonSchemaType.OBJECT,
            required: ['hasMore'],
            properties: {
              hasMore: { type: apigateway.JsonSchemaType.BOOLEAN },
              nextKey: { type: apigateway.JsonSchemaType.STRING },
            },
          },
          message: {
            type: apigateway.JsonSchemaType.STRING,
          },
        },
      },
    });

    const errorResponseModel = new apigateway.Model(this, 'ErrorResponseModel', {
      restApi: api,
      contentType: 'application/json',
      modelName: 'ErrorResponseModel',
      schema: {
        type: apigateway.JsonSchemaType.OBJECT,
        required: ['success', 'error'],
        properties: {
          success: {
            type: apigateway.JsonSchemaType.BOOLEAN,
          },
          error: {
            type: apigateway.JsonSchemaType.STRING,
          },
          message: {
            type: apigateway.JsonSchemaType.STRING,
          },
        },
      },
    });

    // Common response parameters for all methods
    const commonResponseParameters = {
      'method.response.header.Access-Control-Allow-Origin': true,
      'method.response.header.Content-Type': true,
      'method.response.header.Access-Control-Allow-Headers': true,
      'method.response.header.Access-Control-Allow-Methods': true,
    };

    // POST /shipments/{shipmentId}/events - Record new event
    eventsResource.addMethod('POST', new apigateway.LambdaIntegration(recordEventFunction), {
      requestValidator: new apigateway.RequestValidator(this, 'RecordEventValidator', {
        restApi: api,
        requestValidatorName: 'record-event-validator',
        validateRequestBody: true,
        validateRequestParameters: true,
      }),
      requestModels: {
        'application/json': recordEvenRequesttModel,
      },
      methodResponses: [
        {
          statusCode: '201',
          responseModels: {
            'application/json': successResponseModel,
          },
          responseParameters: commonResponseParameters,
        },
        {
          statusCode: '400',
          responseModels: {
            'application/json': errorResponseModel,
          },
          responseParameters: commonResponseParameters,
        },
        {
          statusCode: '500',
          responseModels: {
            'application/json': errorResponseModel,
          },
          responseParameters: commonResponseParameters,
        },
      ],
      requestParameters: {
        'method.request.path.shipmentId': true,
      },
    });

    // GET /shipments/{shipmentId}/events - Get event history
    eventsResource.addMethod('GET', new apigateway.LambdaIntegration(getEventHistoryFunction), {
      requestValidator: new apigateway.RequestValidator(this, 'GetEventsValidator', {
        restApi: api,
        requestValidatorName: 'get-events-validator',
        validateRequestParameters: true,
      }),
      requestParameters: {
        'method.request.path.shipmentId': true,
        'method.request.querystring.limit': false,
        'method.request.querystring.startKey': false,
      },
      methodResponses: [
        {
          statusCode: '200',
          responseModels: {
            'application/json': paginatedResponseModel,
          },
          responseParameters: commonResponseParameters,
        },
        {
          statusCode: '400',
          responseModels: {
            'application/json': errorResponseModel,
          },
          responseParameters: commonResponseParameters,
        },
        {
          statusCode: '404',
          responseModels: {
            'application/json': errorResponseModel,
          },
          responseParameters: commonResponseParameters,
        },
        {
          statusCode: '500',
          responseModels: {
            'application/json': errorResponseModel,
          },
          responseParameters: commonResponseParameters,
        },
      ],
    });

    // GET /shipments/{shipmentId}/events/latest - Get latest event
    const latestResource = eventsResource.addResource('latest');
    latestResource.addMethod('GET', new apigateway.LambdaIntegration(getLatestEventFunction), {
      requestValidator: new apigateway.RequestValidator(this, 'GetLatestEventValidator', {
        restApi: api,
        requestValidatorName: 'get-latest-event-validator',
        validateRequestParameters: true,
      }),
      requestParameters: {
        'method.request.path.shipmentId': true,
      },
      methodResponses: [
        {
          statusCode: '200',
          responseModels: {
            'application/json': successResponseModel,
          },
          responseParameters: commonResponseParameters,
        },
        {
          statusCode: '400',
          responseModels: {
            'application/json': errorResponseModel,
          },
          responseParameters: commonResponseParameters,
        },
        {
          statusCode: '404',
          responseModels: {
            'application/json': errorResponseModel,
          },
          responseParameters: commonResponseParameters,
        },
        {
          statusCode: '500',
          responseModels: {
            'application/json': errorResponseModel,
          },
          responseParameters: commonResponseParameters,
        },
      ],
    });

    // Create CloudWatch Log Groups with explicit names
    new logs.LogGroup(this, 'RecordEventLAMBDALogGroup', {
      logGroupName: `/aws/lambda/${recordEventFunction.functionName}`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    new logs.LogGroup(this, 'GetEventHistoryLAMBDALogGroup', {
      logGroupName: `/aws/lambda/${getEventHistoryFunction.functionName}`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    new logs.LogGroup(this, 'GetLatestEventLAMBDALogGroup', {
      logGroupName: `/aws/lambda/${getLatestEventFunction.functionName}`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Output important information
    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: api.url,
      description: 'API Gateway URL',
      exportName: 'PostNordEventTrackerApiUrl',
    });

    new cdk.CfnOutput(this, 'DynamoDBTableName', {
      value: shipmentEventsTable.tableName,
      description: 'DynamoDB Table Name',
      exportName: 'PostNordShipmentEventsTableName',
    });

    new cdk.CfnOutput(this, 'DynamoDBTableArn', {
      value: shipmentEventsTable.tableArn,
      description: 'DynamoDB Table ARN',
      exportName: 'PostNordShipmentEventsTableArn',
    });

    // Add tags to all resources
    cdk.Tags.of(this).add('Project', 'PostNordEventTracker');
    cdk.Tags.of(this).add('Environmentt', 'PRODDDD');
    cdk.Tags.of(this).add('Owner', 'Gaurav');
  }
}
