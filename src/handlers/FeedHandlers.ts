import { stringify } from "../lib/results.js";
import { McpError, ErrorCode } from "../lib/errors.js";
import { BaseHandler } from "./BaseHandler.js";
import type { ToolDefinition } from "../types/tools.js";
import { ADTClient } from "abap-adt-api";

export class FeedHandlers extends BaseHandler {
  getTools(): ToolDefinition[] {
    return [
      {
        name: "feeds",
        description: "Retrieves a list of feeds.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "dumps",
        description: "Retrieves a list of dumps.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "An optional query string to filter the dumps.",
              optional: true,
            },
          },
        },
      },
    ];
  }

  async handle(toolName: string, args: any): Promise<any> {
    switch (toolName) {
      case "feeds":
        return this.handleFeeds(args);
      case "dumps":
        return this.handleDumps(args);
      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown feed tool: ${toolName}`,
        );
    }
  }

  async handleFeeds(args: any): Promise<any> {
    const startTime = performance.now();
    try {
      const feeds = await this.adtclient.feeds();
      this.trackRequest(startTime, true);
      return {
        content: [
          {
            type: "text",
            text: stringify({
              status: "success",
              feeds,
            }),
          },
        ],
      };
    } catch (error: any) {
      this.trackRequest(startTime, false);
      throw error;
    }
  }

  async handleDumps(args: any): Promise<any> {
    const startTime = performance.now();
    try {
      const dumps = await this.adtclient.dumps(args.query);
      this.trackRequest(startTime, true);
      return {
        content: [
          {
            type: "text",
            text: stringify({
              status: "success",
              dumps,
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
