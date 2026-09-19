# Agent Notes

这里只存放一类文档：**Agent Note**。它记录影响本仓库的决策或提案——*为什么*、*放弃了什么*，即代码和普通文档承载不了的部分。本文件定义 Agent Note 的存放位置、何时必须写、以及[文件格式](#文件格式)。

> 本体系移植自 deepseek-harness 的 `.agents/notes/`：两轴路径、生命周期目录、类别封闭集、统一文件格式、Alternatives 强制、无中央索引。与原版不匹配本仓库的部分做了显式删减，见[适配差异](#适配差异相对-deepseek-harness-原版)。

## 目录布局与命名

每篇 Agent Note 有两个轴，都编码在**路径**里——`{lifecycle}/{class}/yyyy-mm-dd-topic-title.md`：

- **Lifecycle**（顶层目录）是笔记的状态；状态变化时文件在目录间移动：
  - **`proposed/`** —— 实现前评审的提案；尚未构建（或只建了一部分）。
  - **`implemented/`** —— 决策已发布。文件记录决定了什么、否决了什么，并**与实际发布保持一致**：当代码随后移动文件、重命名包、修改 key 或默认值时，同一变更内更新 Agent Note 使其匹配（只改事实——路径、名称、结构——不改决策本身）。见 [implemented/AGENTS.md](implemented/AGENTS.md)。
  - **`rejected/`** —— 提案被考虑后拒绝。仅当其 rationale 仍能阻止一个有诱惑力的、有意义的错误时保留；否则删除整个文件。
- **Class**（嵌套目录）是决策的*种类*，见下方[分类](#分类)。

文件名中的日期是话题**首次提出**的日期（以 git 历史为准）。笔记之间的交叉引用使用相对 markdown 链接（`[topic](../../implemented/architecture/2026-…-….md)`）——绝不使用裸文字或编号——这样链接可机械检查，且在目录间移动后依然有效。

活动树（proposed/implemented/rejected）就是工作清单：浏览其 lifecycle/class 目录，或全库检索。**不要建集中的 `INDEX.md`**——目录树本身就是索引，集中索引必然过期。低未来价值的 implemented 记录移入独立的冻结归档树 [`archived/`](archived/AGENTS.md)。

类别目录按需创建（有内容才建目录）；封闭集见下节。

## 分类

每篇 Agent Note 属于一个路径编码的 class，取值限定为下方封闭集合；评审时拒绝其他目录名。新增 class 需要同时更新本节。

| Class | 覆盖范围 |
|---|---|
| `feature` | 面向用户或模型的新能力。 |
| `bug-fix` | 修正缺陷，或填补 postmortem 暴露的缺口。 |
| `simplification` | 移除代码、行为或表面积，而不新增能力。 |
| `architecture` | 关于**发布的源码**的结构性决策——模块如何关联、运行时词汇是什么。 |
| `process` | 代码**周围**的工具、政策或工作流——门禁、生成脚本、验证方式——而非运行时行为。 |
| `testing` | 测试基础设施与策略。 |

`architecture` / `process` 的分界：**architecture** 关于我们发布的源码；**process** 关于周边的工具与工作流。（刻意不含 `refactor`——它与 `simplification` 重叠，后者的判据"可观察行为是否改变？"已经覆盖它。）

## 归档与删除

当一篇 implemented 笔记对应的发布决策已完整、且其 rationale 不太可能再指导未来工作时，将它归档。当它的替代方案、所有权边界、负面保证、持久/线上语义、安全规则或重新引入条件仍然有用时，保持活动。**永不归档 proposed 笔记**：过时的提案应改为 rejected。rejected 笔记仅在其仍能阻止一个可信的错误时保留；否则整个文件删除。

归档路径为 `archived/{class}/yyyy-mm-dd-topic-title.md`；刻意不含 `implemented`，因为只有 implemented 笔记能进入归档。归档变更只允许：移动整个文件、保持 `Status: implemented`、紧贴该行下方插入同一 `Archived: YYYY-MM-DD` 行、修复或删除入站链接。封存由同目录 `.archive-manifest.json`（SHA-256，append-only）机械强制：清单与文件一一对应，回改或删除即 `npm run verify:agents` 失败；新归档用 `npm run verify:agents -- --write` 计入，清单只增不改。

封存之后，归档笔记永久冻结：不编辑、不重排格式、不翻译、不更新、不移动、不删除，也不将其视为当前行为的权威。活动文档可以在有意引用历史时链接进归档笔记，但不检查、不修复归档笔记的出站链接。使用校准过的 [archive-agent-notes](../skills/archive-agent-notes/SKILL.md) 工作流判断，而不是字数、年龄或配额。

## 何时必须写

每个非平凡变更必须在同一提交（PR）里新增或更新至少一篇 Agent Note。变更在以下情况是非平凡的：改变行为、架构、跨文件或跨包的契约、process 或工具、测试策略、磁盘/线上/配置格式，或维护者可能合理重新审视的其他决策。大规模未来工作的提案从 `proposed/` 开始；已做出的决策从 `implemented/` 开始。选择与决策匹配的 class 目录（见[分类](#分类)）。

更新已拥有该决策的现有笔记即可满足规则；不要制造重复。只有纯机械或局部、不改变行为/契约/结构/process/rationale 的编辑豁免。

**Agent Note 永远不被编辑成另一个决策**：用新笔记 supersede 它，并保持两篇互相链接。一篇被*完全* supersede 的 implemented 笔记可以合并进当前属主笔记后删除——删除前，属主必须保留每一项独有的 rationale、替代方案、后果与必需验证，并修复所有入站链接；**部分** supersession 不符合合并条件：保持两篇互相链接，并更新所有仍然有效的事实。

## 文件格式

每篇活动的 Agent Note 遵循统一的文件内格式；机械格式由 `npm run verify:agents` 门禁校验（文件头、骨架段、Status 与目录一致），语义由评审与技能把关。正文用中文；文件头与段落标题的机读 token 保持英文。

### 文件头

每篇 Agent Note 的前三行恰好是：

```markdown
# Agent Note: <标题>

Status: <状态>
```

后跟空行。`Status:` 取三种形式之一，且必须与文件所在的 lifecycle 目录一致：

- `Status: proposed`
- `Status: implemented`
- `Status: rejected — <一句话原因>`

状态行不带日期、不带括号注释：文件名持有首次提出日期，git 持有一切其他时间信息，"以修订形式接受"属于正文内容（在陈述决策处写明修订）。拒绝原因是唯一带内容的状态，因为读者来看的就是被拒提案的结论。

### 正文骨架

每篇 Agent Note 以 `## Problem` 开篇——动机，须脱离解决方案独立成立。其后依 lifecycle 而定；固定段落使用以下规范名称，不得使用其他名称，而真正的技术定制段落（包拓扑、线上契约、schema）在必需段落之间自由组织：

#### `proposed/`

```markdown
## Problem
## Proposal
…定制段落…
## Alternatives considered
## Acceptance criteria
## Risks
```

`## Proposal` 是打算做的变更，可以用将来时——计划、迁移步骤、开放问题在未构建期间都属于这里。`## Acceptance criteria` 说明什么可观察状态算完成。`## Risks` 覆盖可能出什么错与这个变更明知放弃了什么。

#### `implemented/`

```markdown
## Problem
## Decision
…定制段落…
## Alternatives considered
## Consequences
```

`## Decision` 用现在时描述已发布的现实，整个文件按 [implemented/AGENTS.md](implemented/AGENTS.md) 的要求与其保持一致。提案式标题在这里是空话，评审拒绝：`## Proposal`、`## Plan`、`## Migration plan`、`## Acceptance criteria` 不得出现在 implemented 笔记中。陈述现在时事实的 `## Testing`、`## Deferred`、`## Related` 段落可以存在。

#### `rejected/`

被拒笔记就是冻结的提案：保留它提案时期的段落（包括 `## Acceptance criteria` 或 `## Plan`），结论写在 `Status:` 行上。只有文件头、`## Problem` 开篇、`## Proposal` 段落与下面的 Alternatives 强制项适用。

### Alternatives considered —— 强制

每篇 Agent Note 都带 `## Alternatives considered` 段落：每个真实的替代方案与它落败的原因，一段一个（粗体引导）或有争议的用 `### 为什么不是 <X>？` 小节。没有记录"它打败了什么"的决策记录会 invites re-litigation——这正是 Agent Note 要防止的失败。替代方案只记录、不发明。

### 生命周期之间的迁移

在 lifecycle 目录之间移动文件意味着同一变更内更新 `Status:` 行并满足目标目录的骨架，否则评审不通过。具体地：`proposed/` → `implemented/` 把 `## Proposal` 改写为现在时的 `## Decision`，把 `## Acceptance criteria` 与 `## Risks` 折叠进 `## Consequences`（或现在时的 `## Testing`/`## Verification`），删掉计划、留下实际发布的；`proposed/` → `rejected/` 只在 `Status:` 行加原因并冻结文件。

## 适配差异（相对 deepseek-harness 原版）

| 原版机制 | 本仓库采用 | 原因 |
|---|---|---|
| 英文正文 + `.zh.md` 中文对照 + `.i18n.yaml` blob-hash sidecar，机器校验配对 | 单语中文正文；文件头与段落标题 token 保持英文 | 没有配对校验机器的双语对必然漂移；token 英文保留未来接入原版 verify 脚本的可能 |
| `verify-agent-note-format` / `verify-archived-agent-notes` 等 CI 门禁；类别封闭集由 `scripts/agent-note-tree.ts` 定义 | 封闭集由本 README 定义；`npm run verify:agents` 单脚本校验预算、笔记格式、链接三类机械不变量，语义判断仍由评审 + [archive-agent-notes](../skills/archive-agent-notes/SKILL.md) 技能把关 | 一个小脚本覆盖三类高频校验，不搬运全套工具链 |
| 归档 append-only 清单 + 哈希校验（`verify-archived-agent-notes`） | `verify-agents` 的 `.archive-manifest.json`（SHA-256、append-only，`--write` 仅新增）机械强制归档冻结 | 同上 |
| 每篇新笔记强制触发全语料 supersession 审计（同一 PR 内完成） | 保留，但scope限定为"覆盖同一决策或机制"的检索式检查 | 语料规模小，全量审计无必要；检索式检查已防止最常见的重复 |
