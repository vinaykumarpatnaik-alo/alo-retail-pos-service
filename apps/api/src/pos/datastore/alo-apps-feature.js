import { DynamoDBClient, GetItemCommand, ScanCommand} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import util from "util";
class DynamoPosAloAccessFeatureConfig {
    constructor(tableName = process.env.FEATURE_CONFIGS_TABLE_NAME, options = { region: process.env.AWS_REGION || "us-east-1" }) {
        if (!tableName) {
            throw new Error("FEATURE_CONFIGS_TABLE_NAME is required");
        }
        this.tableName = tableName;
        this.client = new DynamoDBClient(options);
    }

    async getFeatureConfig(id) {
        const params = {
            TableName: this.tableName,
            Key: marshall({id: id})
        };

        const command = new GetItemCommand(params);
        const response = await this.client.send(command);
        console.log(util.format("Feature config response %j",response));
        return unmarshall(response.Item);
    }
    async loadEnableFlag(id) {
        console.log("Loading Flag from DynamoDB for id : ", id);
        try {
          console.log("Loading Flag from DynamoDB  TRY ");
          let params = {
            TableName: this.tableName,
            Key: {
              id: { S: id },
            },
          };
          console.log("Loading Flag from DynamoDB  params :", params);
          let data = await this.client.send(new GetItemCommand(params));
          console.log(
            "Loading Flag retrieved from Dynamo DB successfully id: ",
            id,
            " data:",
            data
          );
          return {
            enableFlag: data?.Item?.enabled?.BOOL || false,
            code: data?.Item?.code?.S || 0,
          };
        } catch (err) {
          console.error("Failed to extract flag...", err);
          return {
            enableFlag: false,
            code: 0,
          };
        }
      }
    
      async loadAllFeatures() {
        console.log("Loading all records from DynamoDB:", this.tableName);
        let enableFlagRecs = [];
        try {
          let params = {
            TableName: this.tableName,
          }; 
          let data = await this.client.send(new ScanCommand(params));
          console.log(`Retrieved ${data.Items.length} session(s) from DynamoDB`);
    
          for (let i = 0; i < data.Items.length; i++) {
            let item = data.Items[i];
            console.log("feature item :", item);
            let dbEnable = {
              id: item?.id?.S,
              enabled: item?.enabled?.BOOL || false,
              code: item?.code?.S || "",
            };
            console.log(`FEATURE RECORD ${dbEnable}`);
            enableFlagRecs.push({ ...dbEnable });
          }
    
          console.log(
            `Constructed ${enableFlagRecs.length} record(s) from retrieved data`
          );
        } catch (err) {
          console.error("Failed to load all records.", err);
        }
        return enableFlagRecs;
      }

}
export default DynamoPosAloAccessFeatureConfig;
