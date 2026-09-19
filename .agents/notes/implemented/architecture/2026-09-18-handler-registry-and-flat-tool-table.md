# Agent Note: Handler 注册表与扁平工具表

Status: implemented

## Problem

上游 flujo-app/mcp-abap-adt 的旧设计把工具路由写成一个巨型 switch：新增一个工具要同时改 handler 的 `getTools()`、handler `handle()` 里的 switch、以及 server 端 ListTools 与 CallTool 两处 switch——四处落点，漏改任何一处就会出现"列得出但调不通"的工具。合并上游 PR #23（bounded workflows rewrite，58ff675）时路由结构被重写；本仓库在 9eda19a/1a2d86a 恢复 fork 特性并统一 fork 身份时保留了新结构。

## Decision

工具注册与分发由三部分组成（`src/server.ts`、`src/handlers/registry.ts`）：

- 每个域一个 handler 类（`src/handlers/*Handlers.ts`，26 个），继承 `BaseHandler`，实现 `getTools(): ToolDefinition[]` 与 `handle(toolName, args)`。
- `registry.ts` 的 `createHandlers(client, cache)` 返回全部 handler 实例；server 启动时 flatMap 成扁平工具表 `{definition, handler, validation: toolSchema(definition)}`——zod schema 由工具定义编译而来；表内重名直接抛错（`Duplicate tool name`）。
- `invoke()` 分发：`healthcheck` 与 `readResultPage` 两个内建工具先行特判，其余按名查表 → zod `safeParse` → `prepare` → 调 handler。

新增工具的落点收敛为 handler 内两处（`getTools()` + `handle()`），自动进入工具表与校验管线。

## Alternatives considered

- **保留巨型 switch**：每工具四处落点、与上游合并时冲突面最大；正是被替换掉的结构。
- **装饰器自动注册**：CommonJS 输出下依赖 reflect-metadata 与隐式加载顺序；显式 registry 数组同样解决问题且零新增依赖。
- **独立 routes 文件集中映射**：制造一份与 handler 平行的名单，回到"两处维护同一事实"。

## Consequences

- 落点从四处收敛到两处；与上游合并的冲突面收缩到 handler 文件本身。
- 旧 `.claude/CLAUDE.md` 曾描述"index.ts 内 AbapAdtServer + switch 路由"，该文档已删除（内容可从 git 历史找回）；指令单源为根 `AGENTS.md`，路由以本笔记与 `src/server.ts` 为准。
- 内建工具（healthcheck/readResultPage）不走 zod 编译路径，是刻意的例外：它们是服务器自身协议，不是 SAP 能力。
