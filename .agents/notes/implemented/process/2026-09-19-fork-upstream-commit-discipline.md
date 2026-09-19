# Agent Note: fork 与上游的 commit 分类纪律

Status: implemented

## Problem

本仓库与兄弟仓库 [abap-adt-api](https://github.com/lingcSun/abap-adt-api) 都是 fork（上游分别为 mario-andreschak/mcp-abap-abap-adt-api 与 marcellourbani/abap-adt-api），每个 commit 天然混杂两类改动：对上游有普适价值的功能与修复，以及 fork 专属的依赖切换、包身份、agent 语料与 CI 门禁。不分类的后果已经发生过一次：向上游的 PR #9 把 26 个 commit（含依赖替换与 agent 文档）整体推给上游，范围失当，只能废弃重开（#25）。若继续依赖临场甄别，每次发 PR 都要重演一次考古。

## Alternatives considered

- **每个上游主题一条长期分支**：分支数量随主题增长，rebase 维护成本高；主题结束后分支要么删要么烂。单一 `pr-upstream` 指针表达"当前可上游的全集"，零额外分支。
- **在 commit message 里自由描述、靠评审分类**：非机械约定必然漂移，PR 重组时也无法机器筛选。
- **用 changelog/manifest 登记分类**：多一份必然过期的中央索引，违背 notes 体系"目录树即索引"的原则。

## Decision

- 每个 commit 创建时归入两类之一：
  - **可上游**：不触碰 fork 专属依赖（`@lingc-sun/abap-adt-api`）、fork 包身份、agent 语料与 CI 门禁，且能在上游依赖与上游代码上编译、测试通过。
  - **fork 专属**：其余一律单独成 commit，message 带 `Fork-only: yes` 尾注并写明归属理由。
- 分支排序固定：可上游 commit 在前、fork 专属在后；`pr-upstream` 分支指向可上游段顶端，向上游发 PR 从该指针出发（上游推进后 rebase/重建）。
- 兄弟仓库 abap-adt-api 采用同一纪律（上游 marcellourbani/abap-adt-api），其 AGENTS.md 与本仓库同源。判据按仓库语境替换：abap-adt-api 的可上游判据是不含 scoped 发布名（`@lingc-sun`）与 agent 语料、可并入上游库的功能与修复。
- 根 AGENTS.md 以一节承载本纪律（预算 2000 → 2300，为新增常驻段落；理由见提交说明）。

## Consequences

- 向上游发 PR 成为机械操作：`pr-upstream` 指针即 PR 内容，fork 专属改动不可能混入。
- `git log --grep "Fork-only: yes"` 可机械列出不可上游集合。
- 代价：可上游改动不得顺手触碰 fork 专属文件（如 package.json 的身份字段），偶尔需要把一个自然改动拆成两个 commit。
- 预算上调后根文件余量收窄，下次扩充仍须走"搬家 → 压缩 → 改预算"的次序。
