import * as cdk from "aws-cdk-lib";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import {
  Chain,
  CustomState,
  DefinitionBody,
  JsonPath,
  StateMachine,
} from "aws-cdk-lib/aws-stepfunctions";
import {
  DynamoAttributeValue,
  DynamoGetItem,
} from "aws-cdk-lib/aws-stepfunctions-tasks";
import { Construct } from "constructs";
import { DynamoUnmarshall } from "./constructs/DynamoUnmarshall";
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class StepFunctionUnmarshallDynamodbStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const table = new Table(this, "Table", {
      partitionKey: { name: "id", type: AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      billingMode: BillingMode.PAY_PER_REQUEST,
    });

    const dynamoDB = new DynamoGetItem(this, "DynamoDB", {
      table,
      key: {
        id: DynamoAttributeValue.fromString(JsonPath.stringAt("$.id")),
      },
      resultSelector: {
        item: JsonPath.stringAt("$.Item"),
      },
    });

    const unmarshall = new DynamoUnmarshall(this, "Unmarshall", {
      path: "$states.input.item",
      variableName: "unmarshalledItem",
    });

    const combine = new CustomState(this, "Combine", {
      stateJson: {
        Type: "Pass",
        QueryLanguage: "JSONata",
        Output: {
          unmarshalledItem: "{% $unmarshalledItem %}",
          map: "{% $unmarshalledItem.MapAttribute.NestedString %}",
          number: "{% $unmarshalledItem.NumberAttribute %}",
        },
      },
    });

    const chain = Chain.start(dynamoDB).next(unmarshall).next(combine);

    const stateMachine = new StateMachine(this, "StateMachine", {
      definitionBody: DefinitionBody.fromChainable(chain),
    });
  }
}
