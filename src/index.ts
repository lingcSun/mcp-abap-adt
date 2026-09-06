#!/usr/bin/env node
import { config } from "dotenv";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createServer, Runtime } from "./server.js";
if (process.env.SAP_ENV_FILE)
  config({ path: process.env.SAP_ENV_FILE, quiet: true });
const runtime = new Runtime();
const handle = serveStdio(() => createServer(runtime), {
  onerror: () => process.stderr.write("MCP transport error\n"),
});
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await runtime.close();
  await handle.close();
}
process.stdin.once("end", () => void close());
process.once("SIGINT", () => void close());
process.once("SIGTERM", () => void close());
