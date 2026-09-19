# mcp-abap-adt — Agent Instructions

`@lingc-sun/mcp-abap-adt`：封装 [`@lingc-sun/abap-adt-api`](https://github.com/lingcSun/abap-adt-api)（不用相对链接，隔离 checkout 会断链）的 MCP 服务器，向 LLM 客户端暴露 ABAP ADT 开发全流程（对象 CRUD、传输、锁定、语法检查、激活、DDIC、调试、ATC 等，约 128 个工具）。

## Commands

```bash
npm run build        # tsc → dist/
npm run check        # tsc --noEmit
npm test             # tsx --test test/*.test.ts
npm run start        # 运行编译产物（stdio 传输）
npm run verify:stdio # stdio 冒烟验证
npm run verify:package
npm run verify:live  # 需要真实 SAP 连接
npm run contracts    # 重新生成 src/lib/input-contracts.json（生成物，勿手改）
```

## Layout

- `src/index.ts` stdio 启动与进程生命周期
- `src/server.ts` 服务器装配：扁平工具表、调用协议（单活动请求、超时/中断、会话恢复门）、结果分页
- `src/handlers/<Domain>Handlers.ts` 按域组织工具（26 个域）；`registry.ts` 汇总
- `src/lib/` 基础设施：adt-client、errors、logger、results（分页）、sourceCache、input-contracts.json（生成物）

## Invariants

- **大字节不经过 LLM 上下文**：大输入走 filePath，大输出走 readResultPage 分页；新增大载荷工具必须接入其中一条通路（[rationale](.agents/notes/implemented/feature/2026-09-18-large-payload-paths.md)）。
- **同一 SAP 会话至多一个在途请求**：请求中断后除 login/logout/dropSession 外一律拒绝，直到显式恢复（[rationale](.agents/notes/implemented/feature/2026-09-18-single-active-request-and-session-recovery.md)）。
- **新增工具只落 handler 两处**（getTools + handle），不写路由分支；工具定义自动进表与校验（[rationale](.agents/notes/implemented/architecture/2026-09-18-handler-registry-and-flat-tool-table.md)）。
- **`src/lib/input-contracts.json` 是生成物**：改契约改工具定义后跑 `npm run contracts`，勿手改（[rationale](.agents/notes/implemented/process/2026-09-18-input-contracts-as-generated-artifact.md)）。

本文件预算 ≤ 2000 字符（按字符计，中英文同口径）。超出先搬家（挪到笔记或 README）、再压缩；确需更多才改这个数字，并在提交说明里给理由。

## Agent Notes

非平凡变更必须在同一提交新增或更新至少一篇 Agent Note（[规则](.agents/notes/README.md#何时必须写)）；每篇新笔记触发 supersession 检查。决策语料在 [.agents/notes/](.agents/notes/AGENTS.md)。写行为断言（文档、注释、笔记）时用 [test-dont-assume](.agents/skills/test-dont-assume/SKILL.md) 技能。门禁 `npm run verify:agents` 校验根文件预算、笔记格式与链接。
