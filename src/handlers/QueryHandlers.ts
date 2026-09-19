import { stringify } from "../lib/results.js";
import { ADTClient } from "@lingc-sun/abap-adt-api";
import { BaseHandler } from "./BaseHandler.js";
import type { ToolDefinition } from "../types/tools.js";

export class QueryHandlers extends BaseHandler {
  getTools(): ToolDefinition[] {
    return [
      {
        name: "tableContents",
        description: "Retrieves the contents of an ABAP table.",
        inputSchema: {
          type: "object",
          properties: {
            ddicEntityName: {
              type: "string",
              description: "The name of the DDIC entity (table or view).",
            },
            rowNumber: {
              type: "number",
              description: "The maximum number of rows to retrieve.",
              optional: true,
            },
            decode: {
              type: "boolean",
              description: "Whether to decode the data.",
              optional: true,
            },
            sqlQuery: {
              type: "string",
              description: "An optional SQL query to filter the data.",
              optional: true,
            },
          },
          required: ["ddicEntityName"],
        },
      },
      {
        name: "runQuery",
        description: "Runs a SQL query on the target system.",
        inputSchema: {
          type: "object",
          properties: {
            sqlQuery: {
              type: "string",
              description: "The SQL query to execute.",
            },
            rowNumber: {
              type: "number",
              description: "The maximum number of rows to retrieve.",
              optional: true,
            },
            decode: {
              type: "boolean",
              description: "Whether to decode the data.",
              optional: true,
            },
          },
          required: ["sqlQuery"],
        },
      },
    ];
  }

  async handle(toolName: string, arguments_: any): Promise<any> {
    switch (toolName) {
      case "tableContents":
        return this.handleTableContents(arguments_);
      case "runQuery":
        return this.handleRunQuery(arguments_);
      default:
        throw new Error(`Tool ${toolName} not implemented in QueryHandlers`);
    }
  }

  async handleTableContents(args: any): Promise<any> {
    const startTime = performance.now();
    try {
      const result = await this.adtclient.tableContents(
        args.ddicEntityName,
        args.rowNumber ?? 100,
        args.decode,
        args.sqlQuery,
      );
      this.trackRequest(startTime, true);
      return {
        content: [
          {
            type: "text",
            text: stringify({
              status: "success",
              result,
            }),
          },
        ],
      };
    } catch (error: any) {
      this.trackRequest(startTime, false);
      throw error;
    }
  }

  async handleRunQuery(args: any): Promise<any> {
    const startTime = performance.now();
    try {
      const result = await this.adtclient.runQuery(
        args.sqlQuery,
        args.rowNumber ?? 100,
        args.decode,
      );
      this.trackRequest(startTime, true);
      return {
        content: [
          {
            type: "text",
            text: stringify({
              status: "success",
              result,
            }),
          },
        ],
      };
    } catch (error: any) {
      this.trackRequest(startTime, false);
      throw error;
    }
  }
}
