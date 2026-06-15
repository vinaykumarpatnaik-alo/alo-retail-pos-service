import { DynamoDBClient, PutItemCommand, GetItemCommand, DeleteItemCommand} from "@aws-sdk/client-dynamodb";

export class DynamoDBExclusionStorage {
    constructor(tableName, options = {region: 'us-east-1'}) {
        this.tableName = tableName;
        this.client = new DynamoDBClient(options);
    }
    async storeExclusionList(id,values) {        
        console.log("Storing exclusion list into DynamoDB: ", JSON.stringify(values));
        try {
            //await this.deleteExclusionList(id);
            //calculate ttl time 
            const SECONDS_IN_AN_HOUR = 60 * 60;
            const secondsSinceEpoch = Math.round(Date.now() / 1000);
            const expirationTime = secondsSinceEpoch + 24 * SECONDS_IN_AN_HOUR;
            console.log("Expires in epoch value -> ",expirationTime)   
            let params = {
                TableName: this.tableName,
                Item: {
                    id: {S: id},
                    values: {SS: values},
                    ttl: {N: new String(expirationTime)},
                }
            };
            const tt = await this.client.send(new PutItemCommand(params));
            console.log("Exclusion data stored successfully",tt);
            return true;
        } catch (err) {
            console.error("Failed to store Exclusion data...",err);
            return false;
        }
    }
    
    async loadExclusionList(id) {
        console.log("Loading Exclusion List from DynamoDB for collection id : ",id);
        try {
            let params = {
                TableName: this.tableName,
                Key: {
                    id: {S: id},
                },
            };
            let data = await this.client.send(new GetItemCommand(params));
            console.log("Exclusion list retrieved from Dynamo DB successfully ",data);
            let products = data.Item.values.SS;
            console.log("Exclusion list object constructed");
            return products;
            
        } catch (err) {
            console.error("Failed to load exclusion list...",err);
            return undefined;
        }
    }
    async deleteExclusionList(id) {
        console.log("Deleting Exclusion List from DynamoDB");

        try {
            let params = {
                TableName: this.tableName,
                Key: {
                    id: {S: id},
                },
            };
            const data = await this.client.send(new DeleteItemCommand(params));
            console.log("Deleted exclusion data: ", data);
            return true;
        } catch (err) {
            console.error("Failed to delete exclusion...",err);
            return false;
        }
    }
}