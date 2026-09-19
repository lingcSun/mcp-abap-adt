import { stringify } from "../lib/results.js";
import { McpError, ErrorCode } from "../lib/errors.js";
import { BaseHandler } from "./BaseHandler.js";
import type { ToolDefinition } from "../types/tools.js";

export class AuthHandlers extends BaseHandler {
  getTools(): ToolDefinition[] {
    return [
      {
        name: "login",
        description: "Authenticate with ABAP system",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "logout",
        description: "Terminate ABAP session",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "dropSession",
        description: "Clear local session cache",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ];
  }

  async handle(toolName: string, args: any): Promise<any> {
    switch (toolName) {
      case "login":
        return this.handleLogin(args);
      case "logout":
        return this.handleLogout(args);
      case "dropSession":
        return this.handleDropSession(args);
      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown auth tool: ${toolName}`,
        );
    }
  }

  private async handleLogin(args: any) {
    const startTime = performance.now();
    try {
      const loginResult = await this.adtclient.login();
      this.trackRequest(startTime, true);
      // The fork's login() resolves the raw HTTP response (compatibility
      // graph); keep the tool contract small and stable instead of leaking
      // the whole response body into the client context.
      return {
        content: [
          {
            type: "text",
            text: stringify({
              status: "logged in",
              httpStatus: loginResult?.status,
            }),
          },
        ],
      };
    } catch (error: any) {
      this.trackRequest(startTime, false);
      throw error;
    }
  }

  private async handleLogout(args: any) {
    const startTime = performance.now();
    try {
      this.sourceCache.clear();
      await this.adtclient.logout();
      this.trackRequest(startTime, true);
      return {
        content: [
          {
            type: "text",
            text: stringify({ status: "Logged out successfully" }),
          },
        ],
      };
    } catch (error: any) {
      this.trackRequest(startTime, false);
      throw error;
    }
  }

  private async handleDropSession(args: any) {
    const startTime = performance.now();
    try {
      this.sourceCache.clear();
      await this.adtclient.dropSession();
      this.trackRequest(startTime, true);
      return {
        content: [
          {
            type: "text",
            text: stringify({ status: "Session cleared" }),
          },
        ],
      };
    } catch (error: any) {
      this.trackRequest(startTime, false);
      throw error;
    }
  }
}
