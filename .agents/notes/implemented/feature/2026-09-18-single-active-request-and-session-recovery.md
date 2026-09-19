# Agent Note: 单活动请求约束与会话恢复门

Status: implemented

## Problem

ADT 有状态会话（`session_types.stateful`）加服务端锁意味着：同一 SAP 会话上并发第二个工具调用会破坏 lockHandle 语义；一次被中断的写操作（客户端断开、超时取消）可能把对象留在锁定态。而 MCP 客户端并不天然串行——LLM 客户端可以并发发出工具调用。

## Decision

`src/server.ts` 的 `invoke()` 实施三条协议：

- **单活动请求**：`active` 标志加 429 错误（"SAP session is busy; cancel or finish the active request first"）。同一时刻至多一个在途 SAP 请求。
- **超时与中断**：每个请求一个 `AbortController`；`SAP_REQUEST_TIMEOUT_MS`（默认 60000，合法区间 100–120000ms）到点取消；MCP 层的 cancel signal 传播为同一个 abort。
- **恢复门**：请求被中断后 `recoveryRequired` 置位，此后除 `login`/`logout`/`dropSession` 外的一切工具被拒（"Previous operation was interrupted. Inspect possible writes/locks, then explicitly login or dropSession before continuing"）；`healthcheck` 暴露 `sessionRecoveryRequired` 供客户端探测状态。

## Alternatives considered

- **请求队列自动串行化**：对 LLM 隐藏排队会让"哪个调用先生效"不可见，写操作的顺序变成隐式契约。
- **中断后自动重登**：被中断的可能是半途的写（锁已持有、源已修改）；自动重登等于掩盖可能的脏状态。显式恢复协议把检查权交还给调用方。
- **改用无状态会话**：CSRF 与 lockHandle 语义要求 stateful；会话过期自愈见传输库侧的决策（abap-adt-api 的会话过期自动重登修复）。

## Consequences

- LLM 可见的 429 与恢复错误成为工作流的一部分；恢复路径只有重新 `login` 或 `dropSession` 两条。
- stateful 客户端刻意关闭 HTTP keepAlive（连接复用与 SAP 会话语义冲突）。
- 恢复门放行的三个工具恰好是"重建会话"与"销毁会话"操作，门本身不依赖 SAP 连接可用。
