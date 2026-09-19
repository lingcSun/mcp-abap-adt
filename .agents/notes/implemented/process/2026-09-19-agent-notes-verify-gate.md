# Agent Note: verify-agents 机械门禁接入 CI

Status: implemented

## Problem

.agents 体系的四类机械不变量——根 AGENTS.md 字符预算、笔记格式、全树链接可达、归档冻结——此前只靠评审把关：归档回改无法被机械发现，预算条款无校验，断链静默累积。仓库虽有 CI，但不含 agent 语料校验，人工复核缺乏提交当下的机械反馈。

## Alternatives considered

- **搬运上游全套 verify 工具链**（agent-note-tree.ts、双语 sidecar、独立归档校验脚本）：语料规模小，笔记 README 对比表已否决过全套搬运。
- **维持纯人工把关**：预算与归档冻结恰是人工最不可靠的两类。

## Decision

单脚本 `scripts/verify-agents.mjs`（`npm run verify:agents`，与 abap-adt-api 同源同内容）覆盖四类不变量；归档由 `.archive-manifest.json`（SHA-256，append-only，`--write` 仅新增、拒绝覆盖已封存哈希）机械封存，清单随归档一并提交。已用沙盒破坏性用例验证：断链、缺预算条款、超预算、Status 与目录不一致、篡改、删除、追加全部按预期拦截或放行。既有 CI 追加 `npm run verify:agents` 一步。隔离 checkout（含 CI）无法解析指向兄弟仓库的相对链接，故根文件对 abap-adt-api 改用绝对 GitHub URL。

## Consequences

- 归档操作新增一步 `npm run verify:agents -- --write`，清单只增不改，回改归档即门禁失败。
- CI 矩阵四个组合各自执行门禁，agent 语料回归与代码回归同门进出。
- 门禁同时拒绝逃出仓库根的相对链接：兄弟仓库在本机"假可达"，隔离 checkout 必死链——CI 已实际拦下 test-dont-assume 技能里的 `../../../../abap-adt-api`；跨仓库引用一律用绝对 GitHub URL。
- 已知边界：围栏代码块内的 markdown 链接示例会误报断链；清单 JSON 损坏时脚本以未捕获异常退出（fail-safe 方向）。
