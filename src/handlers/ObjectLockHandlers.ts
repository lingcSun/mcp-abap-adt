import { stringify } from "../lib/results.js";
import { McpError, ErrorCode } from "../lib/errors.js";
import { BaseHandler } from "./BaseHandler.js";
import type { ToolDefinition } from "../types/tools.js";
import { ADTClient, session_types } from "@lingc-sun/abap-adt-api";

export class ObjectLockHandlers extends BaseHandler {
  getTools(): ToolDefinition[] {
    return [
      {
        name: "lock",
        description: "Lock an object",
        inputSchema: {
          type: "object",
          properties: {
            objectUrl: {
              type: "string",
              description: "URL of the object to lock",
            },
            accessMode: {
              type: "string",
              description: "Access mode for the lock",
              optional: true,
            },
          },
          required: ["objectUrl"],
        },
      },
      {
        name: "unLock",
        description: "Unlock an object",
        inputSchema: {
          type: "object",
          properties: {
            objectUrl: {
              type: "string",
              description: "URL of the object to unlock",
            },
            lockHandle: {
              type: "string",
              description: "Lock handle obtained from previous lock operation",
            },
          },
          required: ["objectUrl", "lockHandle"],
        },
      },
    ];
  }
  async handle(toolName: string, args: any): Promise<any> {
    switch (toolName) {
      case "lock":
        return this.handleLock(args);
      case "unLock":
        return this.handleUnlock(args);
      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown object lock tool: ${toolName}`,
        );
    }
  }

  async handleLock(args: any): Promise<any> {
    const startTime = performance.now();
    try {
      // dropSession/logout reset the client to stateless; locks require a stateful session
      this.adtclient.stateful = session_types.stateful;
      const lockResult = await this.adtclient.lock(
        args.objectUrl,
        args.accessMode,
      );
      this.trackRequest(startTime, true);
      return {
        content: [
          {
            type: "text",
            text: stringify({
              status: "success",
              lockHandle: lockResult.LOCK_HANDLE,
              message: "Object locked successfully",
            }),
          },
        ],
      };
    } catch (error: any) {
      this.trackRequest(startTime, false);
      throw error;
    }
  }

  async handleUnlock(args: any): Promise<any> {
    const startTime = performance.now();
    try {
      // dropSession/logout reset the client to stateless; locks require a stateful session
      this.adtclient.stateful = session_types.stateful;
      await this.adtclient.unLock(args.objectUrl, args.lockHandle);
      this.trackRequest(startTime, true);
      return {
        content: [
          {
            type: "text",
            text: stringify({
              status: "success",
              message: "Object unlocked successfully",
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
