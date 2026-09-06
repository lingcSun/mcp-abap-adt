import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { AsyncLocalStorage } from "node:async_hooks";
import type { HttpClient } from "abap-adt-api";
import { McpError, ErrorCode } from "./errors.js";
export const requestContext = new AsyncLocalStorage<{ signal: AbortSignal }>();
export class BoundedHttpClient implements HttpClient {
  constructor(readonly base: URL) {}
  async request(
    options: Parameters<HttpClient["request"]>[0],
  ): Promise<Awaited<ReturnType<HttpClient["request"]>>> {
    const context = requestContext.getStore();
    if (!context)
      throw new McpError(
        ErrorCode.InternalError,
        "SAP request outside an owned operation",
      );
    context.signal.throwIfAborted();
    const url = new URL(options.url, this.base);
    let decoded = url.pathname;
    for (let i = 0; i < 3; i++) {
      try {
        const next = decodeURIComponent(decoded);
        if (next === decoded) break;
        decoded = next;
      } catch {
        throw new McpError(ErrorCode.InvalidParams, "Invalid SAP URL encoding");
      }
    }
    if (
      options.url.length > 8192 ||
      url.origin !== this.base.origin ||
      url.username ||
      url.password ||
      url.hash ||
      !decoded.startsWith("/sap/") ||
      decoded.includes("\\") ||
      decoded.split("/").some((s) => s === "." || s === "..")
    )
      throw new McpError(
        ErrorCode.InvalidParams,
        "SAP request must stay on the configured origin and /sap/ paths",
      );
    for (const [key, value] of Object.entries(options.qs ?? {}))
      if (value !== undefined && value !== null)
        url.searchParams.set(key, String(value));
    const body = options.body ?? "";
    if (Buffer.byteLength(body) > 2 * 1024 * 1024)
      throw new McpError(
        ErrorCode.InvalidParams,
        "SAP request body exceeds 2MiB",
      );
    const headers: Record<string, string> = {
      ...options.headers,
      "Accept-Encoding": "identity",
    };
    if (body) headers["Content-Length"] = String(Buffer.byteLength(body));
    if (options.auth)
      headers.Authorization =
        "Basic " +
        Buffer.from(
          options.auth.username + ":" + options.auth.password,
        ).toString("base64");
    return await new Promise((resolve, reject) => {
      const req = (url.protocol === "https:" ? httpsRequest : httpRequest)(
        url,
        {
          method: options.method ?? "GET",
          headers,
          signal: context.signal,
          agent: false,
          rejectUnauthorized: true,
        },
        (res) => {
          const chunks: Buffer[] = [];
          let bytes = 0;
          const fail = (message: string) => {
            res.destroy();
            reject(new McpError(ErrorCode.InternalError, message));
          };
          if (res.statusCode! >= 300 && res.statusCode! < 400) {
            fail("SAP redirect rejected; configure the final HTTPS origin");
            return;
          }
          if (
            res.headers["content-encoding"] &&
            res.headers["content-encoding"] !== "identity"
          ) {
            fail("Compressed SAP response rejected");
            return;
          }
          if (Number(res.headers["content-length"] ?? 0) > 4 * 1024 * 1024) {
            fail("SAP response exceeds 4MiB; narrow the query");
            return;
          }
          res.on("data", (chunk: Buffer) => {
            bytes += chunk.length;
            if (bytes > 4 * 1024 * 1024)
              fail("SAP response exceeds 4MiB; narrow the query");
            else chunks.push(chunk);
          });
          res.on("error", () =>
            reject(
              new McpError(
                ErrorCode.InternalError,
                "SAP response interrupted; a write may already have been applied",
              ),
            ),
          );
          res.on("end", () => {
            const text = Buffer.concat(chunks).toString("utf8");
            if (
              (/xml/i.test(String(res.headers["content-type"] ?? "")) ||
                /^\s*<\?xml/.test(text)) &&
              /<!DOCTYPE|<!ENTITY/i.test(text)
            ) {
              reject(
                new McpError(
                  ErrorCode.InternalError,
                  "SAP XML entity declarations rejected",
                ),
              );
              return;
            }
            const responseHeaders: Record<string, string | string[]> = {};
            for (const [key, value] of Object.entries(res.headers))
              if (value !== undefined) responseHeaders[key] = value;
            resolve({
              body: text,
              status: res.statusCode ?? 500,
              statusText: res.statusMessage ?? "",
              headers: responseHeaders,
            });
          });
        },
      );
      req.on("error", () =>
        reject(
          new McpError(
            ErrorCode.InternalError,
            context.signal.aborted
              ? "SAP operation cancelled or timed out; inspect the system before retrying a write"
              : "SAP connection failed; verify reachability and trusted CA. A write may already have been applied.",
          ),
        ),
      );
      req.end(body);
    });
  }
}
