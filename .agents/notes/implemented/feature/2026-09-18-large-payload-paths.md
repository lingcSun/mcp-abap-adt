# Agent Note: 大载荷三通路——filePath、sourceCache、结果分页

Status: implemented

## Problem

ABAP 源码、DDIC 结构、query 结果动辄数十 KB 到 MB 级；全部内联进 MCP 响应会撑爆 LLM 上下文。反向同样成立：让 LLM 在工具参数里内联整段源码，既贵又容易在生成侧被截断。上游合并（58ff675）期间 `setObjectSource` 的 filePath 支持一度丢失，9eda19a 恢复——大载荷通路是 fork 必须守住的能力。

## Decision

三条互补通路，共同原则是**大字节不经过 LLM 上下文**：

- **输入侧 filePath**：`setObjectSource` 等大参数工具接受本地文件路径代替内联 source，服务器读盘后发送。
- **sourceCache**（`src/lib/sourceCache.ts`）：`getObjectSource` 结果按对象 URL 缓存，上限 8 MiB 总量 / 64 条 / TTL 5 分钟，超限逐出最旧条目；变更类工具命中 `mutations` 集合（`src/server.ts` 顶部手工维护）时清空缓存，防止编辑后读到旧源。
- **结果分页**（`src/lib/results.ts` 的 `ResultPages` + 内建工具 `readResultPage`）：大结果写入服务器侧分页存储（单结果上限 4 MiB，超出直接报错并要求收窄 SAP 查询，不报部分成功），MCP 响应只回摘要加 `resultId`，客户端用 `readResultPage(resultId, offset, maxCharacters=16000)` 翻页。

## Alternatives considered

- **静默截断**：丢数据，且 LLM 无从得知截断发生在哪。
- **不缓存**：读-改-写工作流每轮都重取全文，纯粹浪费。
- **全量内联**：MB 级 DDIC 表数据直接致命。

## Consequences

- 工作流要求 LLM 管理两种句柄：文件路径（输入侧）与 `resultId`（输出翻页）。
- `mutations` 集合是手工清单而非元数据派生——与 mcp-bw-adt 从 `ToolDef.mutating` 派生的做法不同；漏登记一个变更工具的后果是缓存多活一个 TTL（5 分钟），当前接受。改为元数据派生是未来的简化方向。
- 4 MiB 硬顶意味着没有"部分成功"语义：错误信息明确要求收窄查询后重试。

## Related

- 工具注册与分发见 [Handler 注册表与扁平工具表](../architecture/2026-09-18-handler-registry-and-flat-tool-table.md)。
