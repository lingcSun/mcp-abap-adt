# Agent Note: 输入契约作为生成物与结构性上限

Status: implemented

## Problem

LLM 生成的工具参数不可信：超长字符串、深嵌套 JSON、非有限数字都可能在 zod 解析前就把内存或时间打穿。而为全部工具（约 128 个）手写 zod schema，又与 handler 内的 `inputSchema` 定义重复同一事实，必然漂移。

## Decision

- **契约即数据**：`scripts/generate-input-contracts.mjs` 从工具定义生成 `src/lib/input-contracts.json`（以及 `scripts/input-contracts-report.json` 供核对）；`src/schema.ts` 的 `toolSchema(definition)` 把契约编译为 zod 校验。**`input-contracts.json` 是生成物，不手改**——改契约改工具定义，然后跑 `npm run contracts` 重新生成。
- **结构上限先于 schema**（`validateJson`）：节点数 ≤ 20000、深度 ≤ 16、字符串 ≤ 1 MiB 且不含 NUL、数字必须有限、数组长度 ≤ 1000。超限抛 `InvalidParams`，不进入业务校验。

## Alternatives considered

- **每工具手写 zod schema**：与 `inputSchema` 两处维护同一事实，漂移只是时间问题。
- **不校验直接透传**：把资源耗尽面暴露给 LLM 输出。
- **仅用 JSON Schema 库校验**：zod 已是依赖，且 `prepare` 步骤（规整化后的参数）需要同一份 schema。

## Consequences

- 收紧全局上限只改 `validateJson` 一处；收紧单个工具改定义再重新生成。
- 契约文件进版本库，评审可见生成物与定义的 drift；报告文件记录生成结果供比对。
- 生成脚本与构建解耦：改工具定义后忘记跑 `contracts` 不会挂构建，靠评审发现——把 `contracts` 挂进 CI 是可选的加固方向。
