import { stringify } from "../lib/results.js";
import { McpError, ErrorCode } from "../lib/errors.js";
import { BaseHandler } from "./BaseHandler.js";
import type { ToolDefinition } from "../types/tools.js";
import { ADTClient, isClassStructure } from "abap-adt-api";

export class ClassHandlers extends BaseHandler {
  getTools(): ToolDefinition[] {
    return [
      {
        name: "classIncludes",
        description: "Get class includes structure",
        inputSchema: {
          type: "object",
          properties: {
            clas: {
              type: "string",
              description: "The class name",
            },
          },
          required: ["clas"],
        },
      },
      {
        name: "classComponents",
        description: "List class components",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "The URL of the class",
            },
          },
          required: ["url"],
        },
      },
    ];
  }

  async handle(toolName: string, args: any): Promise<any> {
    switch (toolName) {
      case "classIncludes":
        return this.handleClassIncludes(args);
      case "classComponents":
        return this.handleClassComponents(args);
      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown class tool: ${toolName}`,
        );
    }
  }

  async handleClassIncludes(args: any): Promise<any> {
    const startTime = performance.now();
    try {
      const structure = await this.adtclient.objectStructure(
        args.clas.startsWith("/")
          ? args.clas
          : `/sap/bc/adt/oo/classes/${encodeURIComponent(args.clas.toLowerCase())}`,
      );
      if (!isClassStructure(structure))
        throw new McpError(
          ErrorCode.InvalidParams,
          "The selected object is not an ABAP class",
        );
      const result = new Map<string, string>();
      for (const include of structure.includes) {
        const link = include.links.find((link) => link.type === "text/plain");
        if (!link?.href)
          throw new McpError(
            ErrorCode.InternalError,
            "Class include has no plain-text source link",
          );
        const resolved = new URL(
          link.href,
          new URL(
            structure.objectUrl.replace(/\/$/, "") + "/",
            "https://sap.invalid",
          ),
        );
        result.set(
          include["class:includeType"],
          resolved.origin === "https://sap.invalid"
            ? resolved.pathname + resolved.search + resolved.hash
            : resolved.href,
        );
      }
      this.trackRequest(startTime, true);
      return {
        content: [
          {
            type: "text",
            text: stringify({
              status: "success",
              result: Object.fromEntries(result),
            }),
          },
        ],
      };
    } catch (error: any) {
      this.trackRequest(startTime, false);
      throw error;
    }
  }

  async handleClassComponents(args: any): Promise<any> {
    const startTime = performance.now();
    try {
      const result = await this.adtclient.classComponents(args.url);
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
