import {Session} from '@shopify/shopify-api';

import { DynamoDBClient, PutItemCommand, GetItemCommand, DeleteItemCommand, BatchWriteItemCommand, ScanCommand} from "@aws-sdk/client-dynamodb";

export class DynamoDBSessionStorage {
    constructor(tableName, options = {region: 'us-east-1'}) {
        this.tableName = tableName;
        this.client = new DynamoDBClient(options);
    }
    async storeSession(session) {        
        console.log("Storing session into DynamoDB: ", JSON.stringify(session));
        try {
            await this.deleteSession(session.id);
            
            let params = {
                TableName: this.tableName,
                Item: {
                    id: {S: session.id},
                    shop: {S: session.shop},
                    state: {S: session.state},
                    isOnline: {BOOL: session.isOnline},
                    scope: {S: session.scope},
                    accessToken: {S: session.accessToken},

                }
            };
            let data = await this.client.send(new PutItemCommand(params));
            console.log("Session data stored: ", data);
            return true;
        } catch (err) {
            console.error("Failed to store session.", err);
            return false;
        }
    }
    async loadSession(id) {
        console.log("Loading session from DynamoDB");

        try {
            let params = {
                TableName: this.tableName,
                Key: {
                    id: {S: id},
                },
            };
            let data = await this.client.send(new GetItemCommand(params));
            if (!data.Item) {
                console.log("Session data not found.");
                return undefined;
            }
            // let sessionDataArray = Object.entries(data.Item).map(([key, value]) => {
            //     if (value.S) {
            //       return value.S;
            //     } else if (value.BOOL) {
            //       return value.BOOL;
            //     }
            // });
            let sessionDataArray = [
                data.Item.id?.S || "",
                data.Item.shop?.S || "",
                data.Item.state?.S || "",
                data.Item.isOnline?.BOOL || false,
                data.Item.scope?.S || "",
                data.Item.accessToken?.S || "",
              ];
              
            console.log("Session data array: ", sessionDataArray);
            let dbSession = Session.fromPropertyArray(sessionDataArray);

            console.log("Session data object constructed : ",JSON.stringify(dbSession));
            return dbSession;

            
        } catch (err) {
            console.error("Failed to load session.", err);
            return undefined;
        }
    }
    async deleteSession(id) {
        console.log("Deleting session from DynamoDB");

        try {
            let params = {
                TableName: this.tableName,
                Key: {
                    id: {S: id},
                },
            };
            const data = await this.client.send(new DeleteItemCommand(params));
            console.log("Deleted session data: ", data);
            return true;
        } catch (err) {
            console.error("Failed to delete session.", err);
            return false;
        }
    }
    async deleteSessions(ids) {
        console.log("Deleting multiple sessions from DynamoDB");

        try {
            const params = {
                RequestItems: {
                }
            };
            params.RequestItems[this.tableName] = []
            ids.forEach((id)=>{
                params.RequestItems[this.tableName].push({
                    DeleteRequest: {
                        Key: {
                            id: {S: id},
                        }
                    }
                });
            })
            let data = await this.client.send(new BatchWriteItemCommand(params));
            console.log("Deleted all sessions with ids "+ids+" : ", data);
            return true;
        } catch (err) {
            console.error("Failed to delete multiple sessions.", err);
            return false;
        }
    }
    async findSessionsByShop(shop) {
        console.log(`Finding sessions from DynamoDB using shop: ${shop}`);
      
        try {
          let params = {
            FilterExpression: "shop = :shop",
            ExpressionAttributeValues: {
              ":shop": { S: shop },
            },
            TableName: this.tableName,
          };
          let results = await this.client.send(new ScanCommand(params));
          console.log("Session data retrieved: ", JSON.stringify(results));
      
          const sessions = results.Items.map((result) => {
            let dbSessionArray = [
              result.id.S,
              result.shop.S,
              result.state.S,
              result.isOnline.BOOL,
              result.scope.S,
              result.accessToken.S,
              // TO DO: Add dbSession.expires value here
            ];
      
            return Session.fromPropertyArray(dbSessionArray);
          });
      
          console.log("Sessions for shop " + shop + " retrieved: ", JSON.stringify(sessions));
      
          return sessions;
        } catch (err) {
          console.error("Failed to find sessions by shop", err);
          return [];
        }
      }
      
}