# Agent Note: npm 发版与版本号规范

Status: implemented

## Problem

四个 ADT 仓库（abap-adt-api、mcp-abap-adt、bw-adt-api、mcp-bw-adt）都发布 npm，但版本号语义与发版步骤此前没有成文规范：升 minor 还是 patch 靠临场判断；版本载体（package.json、server.json、CHANGELOG）分散易漏；publish 默认 registry 是安装镜像 npmmirror，直发会打错目标。mcp-abap-adt 1.3.0 的发布过程暴露了这份清单缺失的代价。

## Alternatives considered

- **changesets / release-please 等工具链**：四仓库发版频率低、维护者单一，工具链的 PR 流程成本高于收益；规范 + 固定 checklist 足够，发版频率上升后再评估。
- **各仓库自由发挥**：下游锁定上游库的版本范围、用户跨仓库判断升级影响，都需要四仓库语义统一。

## Decision

- **semver 语义**（按项目类型）：
  - 库（abap-adt-api、bw-adt-api）：major = 破坏性客户端 API（删改端点/类型、既有签名语义变化）；minor = 新端点/新域/新类型；patch = 修复、文档、内部重构。
  - MCP server（mcp-abap-adt、mcp-bw-adt）：major = 破坏工具契约（删工具、必填参数语义变化、响应结构不兼容）；minor = 新工具/新参数/新能力；patch = 修复、文档、元数据。
- **0.x 特例**（bw-adt-api、mcp-bw-adt）：0.y.z 期间 minor 允许携带破坏性变更（semver 0.x 惯例）；对外 API/工具面声明稳定时升 1.0.0。
- **fork 特例**：abap-adt-api 版本跟随上游 tag，fork 发布递增第三位（8.4.3 → 8.4.4），上游合并新 tag 后基线上移，破坏性变更经 CHANGELOG 与下游 mcp-abap-adt 协调；mcp-abap-adt 版本与上游脱钩（上游 0.1.1，本库 1.3.0），纯 semver。
- **release commit**：`chore(release): x.y.z`，一次性集中全部版本载体——package.json；server.json（仅 mcp-abap-adt 有）；CHANGELOG.md 条目（仅 abap-adt-api、mcp-abap-adt 有）。
- **发布前验证全绿才可 publish**：
  - 库（abap-adt-api、bw-adt-api）：`npm run build && npm test`（集成测试未配置环境自动跳过）
  - mcp-abap-adt：`npm test && npm run verify:stdio && npm run verify:package`
  - mcp-bw-adt：`npm run build && npm run list-tools`
- **publish 目标**：`npm publish --registry https://registry.npmjs.org`——用户级 .npmrc 默认 registry 是 npmmirror（安装镜像），publish 必须显式指定。
- **依赖耦合**：MCP server 对库的依赖范围（^x.y.z）必须是本版本实测过的库版本；库发破坏性变更后，下游 server 先适配再发版。
- fork 仓库的 release commit 属 fork 专属，按各仓库 commit 纪律打标（mcp-abap-adt 加 `Fork-only: yes` 尾注；abap-adt-api 用 `(fork)` scope + 尾注）。

## Consequences

- 发版成为可对照的固定清单：漏版本载体或跳过验证即流程违例。
- 四仓库语义统一：读版本号即可判断升级影响，破坏性变更可提前跨仓库协调。
- 根 AGENTS.md 只承载一行语义 + checklist 链接，细节归本笔记（预算受限）。
