import { z } from "zod";
import contracts from "./lib/input-contracts.json" with { type: "json" };
import type { ToolDefinition } from "./types/tools.js";
import { ErrorCode, McpError } from "./lib/errors.js";
const originalContracts = contracts as Record<string, Record<string, any>>;
export function validateJson(value: unknown) {
  let nodes = 0;
  const visit = (v: unknown, depth: number) => {
    if (++nodes > 20000 || depth > 16)
      throw new McpError(
        ErrorCode.InvalidParams,
        "Input exceeds JSON structure limits",
      );
    if (typeof v === "string" && (v.length > 1048576 || v.includes("\0")))
      throw new McpError(
        ErrorCode.InvalidParams,
        "Input string exceeds limits",
      );
    if (typeof v === "number" && !Number.isFinite(v))
      throw new McpError(
        ErrorCode.InvalidParams,
        "Input number must be finite",
      );
    if (v && typeof v === "object") {
      if (Array.isArray(v) && v.length > 1000)
        throw new McpError(
          ErrorCode.InvalidParams,
          "Input array exceeds 1000 items",
        );
      for (const [key, x] of Object.entries(v)) {
        if (["__proto__", "prototype", "constructor"].includes(key))
          throw new McpError(ErrorCode.InvalidParams, "Unsafe object key");
        visit(x, depth + 1);
      }
    }
  };
  visit(value, 0);
  if (Buffer.byteLength(JSON.stringify(value)) > 2 * 1024 * 1024)
    throw new McpError(ErrorCode.InvalidParams, "Input exceeds 2MiB");
}
const position = {
  type: "object",
  properties: {
    line: { type: "integer", minimum: 1 },
    column: { type: "integer", minimum: 0 },
  },
  required: ["line", "column"],
  additionalProperties: false,
};
const overrides: Record<string, Record<string, any>> = {
  activateObjects: {
    objects: {
      type: "array",
      minItems: 1,
      maxItems: 1000,
      items: {
        type: "object",
        properties: Object.fromEntries(
          [
            "adtcore:uri",
            "adtcore:type",
            "adtcore:name",
            "adtcore:parentUri",
          ].map((key) => [
            key,
            { type: "string", minLength: 1, maxLength: 8192 },
          ]),
        ),
        required: [
          "adtcore:uri",
          "adtcore:type",
          "adtcore:name",
          "adtcore:parentUri",
        ],
        additionalProperties: true,
      },
    },
  },
  extractMethodEvaluate: {
    range: {
      type: "object",
      properties: { start: position, end: position },
      required: ["start", "end"],
      additionalProperties: false,
    },
  },
  getObjectSource: {
    startLine: { type: "integer", minimum: 1, maximum: 10000000 },
    maxLines: { type: "integer", minimum: 1, maximum: 10000 },
  },
  tableContents: { rowNumber: { type: "integer", minimum: 1, maximum: 1000 } },
  runQuery: { rowNumber: { type: "integer", minimum: 1, maximum: 1000 } },
  searchObject: { max: { type: "integer", minimum: 1, maximum: 1000 } },
  createAtcRun: { maxResults: { type: "integer", minimum: 1, maximum: 1000 } },
};
function acceptsString(schema: any): boolean {
  return (
    schema.type === "string" || (schema.anyOf?.some(acceptsString) ?? false)
  );
}
export function toolSchema(tool: ToolDefinition) {
  const shape: Record<string, z.ZodType> = {},
    compat = new Map<string, z.ZodType>();
  for (const [key, old] of Object.entries(tool.inputSchema.properties)) {
    let contract =
      overrides[tool.name]?.[key] ?? originalContracts[tool.name]?.[key];
    if (!contract || !Object.keys(contract).length)
      contract =
        old.type === "array"
          ? { type: "array", items: {}, maxItems: 1000 }
          : old.type === "object"
            ? { type: "object", additionalProperties: true }
            : {
                type: old.type,
                ...(old.type === "string" ? { maxLength: 1048576 } : {}),
              };
    let type = z.fromJSONSchema(contract);
    if (
      old.type === "string" &&
      !acceptsString(contract) &&
      (contract.type === "object" ||
        contract.type === "array" ||
        contract.anyOf)
    ) {
      compat.set(key, type);
      type = z.union([type, z.string().max(1048576)]);
    }
    if (/^(line|column|startCol|endCol|startColumn|endColumn|index)$/.test(key))
      type = z.int().min(0).max(10000000);
    if (old.description) type = type.describe(old.description);
    shape[key] = tool.inputSchema.required?.includes(key)
      ? type
      : type.optional();
  }
  return {
    schema: z.strictObject(shape),
    prepare: (args: Record<string, unknown>) => {
      validateJson(args);
      const result = { ...args };
      for (const [key, type] of compat)
        if (typeof result[key] === "string") {
          let value;
          try {
            value = JSON.parse(result[key] as string);
          } catch {
            throw new McpError(
              ErrorCode.InvalidParams,
              `${key} must be an object or valid JSON`,
            );
          }
          validateJson(value);
          const parsed = type.safeParse(value);
          if (!parsed.success)
            throw new McpError(
              ErrorCode.InvalidParams,
              `${key} does not match its SAP structure`,
            );
          result[key] = parsed.data;
        }
      if (
        result.debuggingMode === "user" &&
        !result.user &&
        !result.requestUser
      )
        throw new McpError(
          ErrorCode.InvalidParams,
          "user/requestUser is required in user debugging mode",
        );
      if (
        tool.name === "debuggerStep" &&
        ["stepRunToLine", "stepJumpToLine"].includes(String(result.steptype)) &&
        !result.url
      )
        throw new McpError(
          ErrorCode.InvalidParams,
          "url is required for this debugger step",
        );
      return result;
    },
  };
}
