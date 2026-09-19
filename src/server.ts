import { CompatibleAdtClient } from "./lib/adt-client.js";
import { McpServer } from "@modelcontextprotocol/server";
import { ADTClient, session_types } from "@lingc-sun/abap-adt-api";
import { z } from "zod";
import { createHandlers } from "./handlers/registry.js";
import { SourceCache } from "./lib/sourceCache.js";
import { ResultPages, textResult } from "./lib/results.js";
import { BoundedHttpClient, requestContext } from "./lib/http.js";
import { ErrorCode, McpError, safeError } from "./lib/errors.js";
import { toolSchema } from "./schema.js";
const mutations = new Set(
  `login logout dropSession createTransport setTransportsConfig createTransportsConfig transportDelete transportRelease transportSetOwner transportAddUser lock unLock setObjectSource deleteObject activateObjects activateByName createObject runClass createTestInclude setPrettyPrinterSetting gitCreateRepo gitPullRepo gitUnlinkRepo stageRepo pushRepo switchRepoBranch publishServiceBinding unPublishServiceBinding debuggerListen debuggerDeleteListener debuggerSetBreakpoints debuggerDeleteBreakpoints debuggerAttach debuggerSaveSettings debuggerStep debuggerGoToStack debuggerSetVariableValue renameExecute createAtcRun atcRequestExemption atcChangeContact tracesSetParameters tracesCreateConfiguration tracesDeleteConfiguration tracesDelete extractMethodExecute unitTestRun unitTestEvaluation`.split(
    " ",
  ),
);
function argumentSecrets(args: unknown): string[] {
  const found: string[] = [];
  const visit = (value: unknown) => {
    if (value && typeof value === "object")
      for (const [key, child] of Object.entries(value)) {
        if (
          /password|token|authorization/i.test(key) &&
          typeof child === "string" &&
          child
        ) {
          found.push(
            child,
            Buffer.from(child).toString("base64"),
            encodeURIComponent(child),
          );
        } else visit(child);
      }
  };
  visit(args);
  return found;
}
const local = new Set(["healthcheck", "readResultPage", "isProposalMessage"]);
export class Runtime {
  readonly cache = new SourceCache();
  readonly pages = new ResultPages();
  readonly handlers;
  readonly tools;
  readonly client?: ADTClient;
  readonly secrets: string[];
  readonly timeoutMs: number;
  private active?: { abort: AbortController; done: Promise<unknown> };
  private closing = false;
  private recoveryRequired = false;
  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.secrets = [env.SAP_PASSWORD ?? "", env.SAP_BEARER_TOKEN ?? ""];
    this.timeoutMs = Number(env.SAP_REQUEST_TIMEOUT_MS ?? 60000);
    if (
      !Number.isInteger(this.timeoutMs) ||
      this.timeoutMs < 100 ||
      this.timeoutMs > 120000
    )
      throw new Error("SAP_REQUEST_TIMEOUT_MS must be 100..120000");
    if (
      env.SAP_URL &&
      env.SAP_USER &&
      (env.SAP_PASSWORD || env.SAP_BEARER_TOKEN)
    ) {
      const base = new URL(env.SAP_URL);
      if (
        (base.protocol !== "https:" &&
          !(
            base.protocol === "http:" &&
            (["127.0.0.1", "localhost", "[::1]"].includes(base.hostname) ||
              env.SAP_ALLOW_HTTP === "1")
          )) ||
        base.username ||
        base.password ||
        base.search ||
        base.hash ||
        base.pathname !== "/"
      )
        throw new Error(
          "SAP_URL must be an HTTPS origin; SAP_ALLOW_HTTP=1 explicitly permits a trusted private HTTP origin",
        );
      if (env.NODE_TLS_REJECT_UNAUTHORIZED === "0")
        throw new Error(
          "TLS verification cannot be disabled; configure NODE_EXTRA_CA_CERTS",
        );
      if (env.SAP_CLIENT && !/^\d{3}$/.test(env.SAP_CLIENT))
        throw new Error("SAP_CLIENT must have three digits");
      const bearer = env.SAP_BEARER_TOKEN;
      this.client = new CompatibleAdtClient(
        new BoundedHttpClient(base),
        env.SAP_USER,
        bearer ? async () => bearer : env.SAP_PASSWORD!,
        env.SAP_CLIENT ?? "",
        env.SAP_LANGUAGE ?? "",
        { keepAlive: false },
      );
      this.client.stateful = session_types.stateful;
    }
    this.handlers = createHandlers(this.client, this.cache);
    this.tools = this.handlers.flatMap((handler) =>
      handler
        .getTools()
        .map((definition) => ({
          definition,
          handler,
          validation: toolSchema(definition),
        })),
    );
    if (
      new Set(this.tools.map((t) => t.definition.name)).size !==
      this.tools.length
    )
      throw new Error("Duplicate tool name");
  }
  async invoke(
    name: string,
    args: Record<string, unknown>,
    signal?: AbortSignal,
  ) {
    if (this.closing)
      throw new McpError(ErrorCode.InternalError, "Server is closing");
    if (name === "healthcheck")
      return textResult({
        status: "ready",
        sapConfigured: !!this.client,
        sapConnectionVerified: false,
        sessionRecoveryRequired: this.recoveryRequired,
        tools: 128,
      });
    if (name === "readResultPage")
      return textResult(
        this.pages.read(
          String(args.resultId),
          Number(args.offset ?? 0),
          Number(args.maxCharacters ?? 16000),
        ),
      );
    const entry = this.tools.find((t) => t.definition.name === name);
    if (!entry) throw new McpError(ErrorCode.MethodNotFound, "Unknown tool");
    const parsed = entry.validation.schema.safeParse(args);
    if (!parsed.success)
      throw new McpError(
        ErrorCode.InvalidParams,
        "Arguments do not match the tool schema",
      );
    const prepared = entry.validation.prepare(parsed.data);
    if (signal?.aborted)
      throw new McpError(
        ErrorCode.InternalError,
        "Request cancelled before SAP operation",
      );
    if (this.active)
      throw new McpError(
        429,
        "SAP session is busy; cancel or finish the active request first",
      );
    if (
      this.recoveryRequired &&
      !["login", "logout", "dropSession"].includes(name)
    )
      throw new McpError(
        ErrorCode.InternalError,
        "Previous operation was interrupted. Inspect possible writes/locks, then explicitly login or dropSession before continuing",
      );
    const abort = new AbortController();
    const cancel = () => abort.abort();
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) cancel();
    const deadline = performance.now() + this.timeoutMs;
    const timer = setTimeout(cancel, this.timeoutMs);
    if (mutations.has(name)) {
      this.cache.clear();
      this.pages.clear();
    }
    if (this.client && !["logout", "dropSession"].includes(name))
      this.client.stateful = session_types.stateful;
    const done = requestContext.run({ signal: abort.signal }, async () => {
      abort.signal.throwIfAborted();
      const result = await entry.handler.handle(name, prepared);
      if (performance.now() > deadline) abort.abort();
      abort.signal.throwIfAborted();
      if (["login", "logout", "dropSession"].includes(name))
        this.recoveryRequired = false;
      return this.pages.wrap(result);
    });
    this.active = { abort, done };
    try {
      return await done;
    } catch (error) {
      if (abort.signal.aborted) {
        this.recoveryRequired = true;
        this.cache.clear();
        this.pages.clear();
        throw new McpError(
          ErrorCode.InternalError,
          "SAP operation cancelled or timed out; inspect writes and locks before explicit session recovery",
        );
      }
      throw new McpError(
        error instanceof McpError ? error.code : ErrorCode.InternalError,
        safeError(error, [...this.secrets, ...argumentSecrets(prepared)]),
      );
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
      this.active = undefined;
    }
  }
  async close() {
    this.closing = true;
    this.active?.abort.abort();
    await this.active?.done.catch(() => {});
    this.cache.clear();
    this.pages.clear();
    if (this.client?.loggedin) {
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), 2000);
      try {
        await requestContext.run({ signal: abort.signal }, () =>
          this.client!.logout(),
        );
      } catch {
      } finally {
        clearTimeout(timer);
      }
    }
  }
}
export function createServer(runtime: Runtime) {
  const server = new McpServer({
    name: "mcp-abap-abap-adt-api",
    version: "0.1.1",
  });
  const active = new Map<string | number, AbortController>();
  server.server.setNotificationHandler(
    "notifications/cancelled",
    async (notification) => {
      if (notification.params?.requestId !== undefined)
        active.get(notification.params.requestId)?.abort();
    },
  );
  const register = (name: string, description: string, schema: z.ZodType) =>
    server.registerTool(
      name,
      {
        description,
        inputSchema: schema,
        annotations: {
          readOnlyHint: !mutations.has(name),
          destructiveHint: mutations.has(name),
          idempotentHint: !mutations.has(name) && name !== "reentranceTicket",
          openWorldHint: !local.has(name),
        },
      },
      async (args, ctx) => {
        const controller = new AbortController();
        const id = ctx.mcpReq.id;
        const cancel = () => controller.abort();
        ctx.mcpReq.signal?.addEventListener("abort", cancel, { once: true });
        if (ctx.mcpReq.signal?.aborted) cancel();
        if (id !== undefined) active.set(id, controller);
        try {
          return await runtime.invoke(
            name,
            args as Record<string, unknown>,
            controller.signal,
          );
        } catch (error) {
          return {
            ...textResult({
              error: safeError(error, runtime.secrets),
              ...(error instanceof McpError ? { code: error.code } : {}),
            }),
            isError: true,
          };
        } finally {
          ctx.mcpReq.signal?.removeEventListener("abort", cancel);
          if (id !== undefined) active.delete(id);
        }
      },
    );
  for (const t of runtime.tools)
    register(t.definition.name, t.definition.description, t.validation.schema);
  register(
    "healthcheck",
    "Local runtime/configuration status; does not claim a verified SAP connection",
    z.strictObject({}),
  );
  register(
    "readResultPage",
    "Read the next page of a large previous JSON tool result; use nextOffset, expires in five minutes. No SAP request is repeated.",
    z.strictObject({
      resultId: z.uuid(),
      offset: z.int().min(0).max(4194304).optional(),
      maxCharacters: z.int().min(2).max(16000).optional(),
    }),
  );
  return server;
}
