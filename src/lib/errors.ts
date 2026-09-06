export const ErrorCode = {
  InvalidParams: -32602,
  InternalError: -32603,
  MethodNotFound: -32601,
};
/** Application error carried as an MCP tool error, never a fabricated transport response. */
export class McpError extends Error {
  constructor(
    public readonly code: number,
    message: string,
  ) {
    super(message);
  }
}
export function safeError(error: unknown, secrets: string[] = []) {
  const e = error as Record<string, unknown> | undefined;
  let message = e instanceof McpError ? e.message : "SAP operation failed";
  if (e?.constructor?.name === "AdtCsrfException")
    return "SAP session or CSRF token expired; inspect locks/writes and explicitly login again";
  if (e && typeof e === "object") {
    const parts: string[] = [];
    for (const field of ["type", "namespace", "localizedMessage"])
      if (typeof e[field] === "string")
        parts.push(field + ": " + String(e[field]).slice(0, 1024));
    if (e.constructor?.name?.startsWith("Adt") && typeof e.message === "string")
      parts.unshift(e.message.slice(0, 2048));
    if (parts.length) message = parts.join("; ");
  }
  for (const secret of secrets.filter(Boolean))
    message = message.split(secret).join("[redacted]");
  message = message
    .replace(/(Bearer|Basic)\s+[A-Za-z0-9+/_=.~-]+/gi, "$1 [redacted]")
    .replace(
      /(password|authorization|cookie|token)\s*[:=]\s*[^\s;]+/gi,
      "$1=[redacted]",
    )
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");
  return message.slice(0, 4096);
}
