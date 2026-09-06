import { randomUUID } from "node:crypto";
import { McpError, ErrorCode } from "./errors.js";
export function stringify(
  value: unknown,
  _replacer?: unknown,
  space?: string | number,
): string {
  return JSON.stringify(
    value ?? null,
    (_key, v) =>
      v instanceof Map
        ? Object.fromEntries(v)
        : v instanceof Set
          ? [...v]
          : typeof v === "bigint"
            ? v.toString()
            : v,
    space,
  );
}
export const textResult = (value: unknown) => ({
  content: [{ type: "text" as const, text: stringify(value) }],
});
export class ResultPages {
  private entries = new Map<string, { text: string; expires: number }>();
  put(text: string) {
    if (Buffer.byteLength(text) > 4 * 1024 * 1024)
      throw new McpError(
        ErrorCode.InternalError,
        "Result exceeds 4MiB; narrow the SAP query. No partial success is reported.",
      );
    const id = randomUUID();
    this.entries.set(id, { text, expires: Date.now() + 300000 });
    while (this.entries.size > 4)
      this.entries.delete(this.entries.keys().next().value!);
    return this.read(id, 0, 16000);
  }
  read(id: string, start: number, count: number) {
    const e = this.entries.get(id);
    if (!e || e.expires <= Date.now()) {
      this.entries.delete(id);
      throw new McpError(
        ErrorCode.InvalidParams,
        "Result page expired or unknown; repeat the original read if needed.",
      );
    }
    if (
      start > e.text.length ||
      (start > 0 &&
        /[\uDC00-\uDFFF]/.test(e.text[start] ?? "") &&
        /[\uD800-\uDBFF]/.test(e.text[start - 1]))
    )
      throw new McpError(
        ErrorCode.InvalidParams,
        "Invalid page offset; use nextOffset.",
      );
    let end = Math.min(e.text.length, start + count);
    if (/[\uD800-\uDBFF]/.test(e.text[end - 1] ?? "")) end--;
    if (end <= start && start < e.text.length)
      throw new McpError(
        ErrorCode.InvalidParams,
        "Page length must fit a full Unicode character",
      );
    return {
      status: "paged",
      resultId: id,
      format: "json",
      offset: start,
      page: e.text.slice(start, end),
      nextOffset: end < e.text.length ? end : null,
      totalCharacters: e.text.length,
      expiresAt: new Date(e.expires).toISOString(),
    };
  }
  wrap(result: any) {
    if (!result || !Array.isArray(result.content)) result = textResult(result);
    if (
      result.content.some(
        (c: any) => c.type !== "text" || typeof c.text !== "string",
      )
    )
      throw new McpError(ErrorCode.InternalError, "Invalid tool result");
    if (Buffer.byteLength(stringify(result)) <= 65536) return result;
    return textResult(this.put(stringify(result)));
  }
  clear() {
    this.entries.clear();
  }
}
