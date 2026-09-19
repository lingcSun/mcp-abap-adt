import { stringify } from "../lib/results.js";
import { McpError, ErrorCode } from "../lib/errors.js";
import { BaseHandler } from "./BaseHandler.js";
import type { ToolDefinition } from "../types/tools.js";
import { AbapObjectStructure, classIncludes } from "@lingc-sun/abap-adt-api";

export class RevisionHandlers extends BaseHandler {
  getTools(): ToolDefinition[] {
    return [
      {
        name: "revisions",
        description: "Retrieves revisions for an object.",
        inputSchema: {
          type: "object",
          properties: {
            objectUrl: {
              type: "string",
              description: "The URL of the object.",
            },
            clsInclude: {
              type: "string",
              description: "The class include.",
              optional: true,
            },
          },
          required: ["objectUrl"],
        },
      },
    ];
  }

  async handle(toolName: string, args: any): Promise<any> {
    switch (toolName) {
      case "revisions":
        return this.handleRevisions(args);
      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown revision tool: ${toolName}`,
        );
    }
  }

  async handleRevisions(args: any): Promise<any> {
    const startTime = performance.now();
    try {
      const revisions = await this.adtclient.revisions(
        args.objectUrl,
        args.clsInclude,
      );
      this.trackRequest(startTime, true);
      return {
        content: [
          {
            type: "text",
            text: stringify({
              status: "success",
              revisions,
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
