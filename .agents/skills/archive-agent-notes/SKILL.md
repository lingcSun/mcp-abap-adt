---
name: archive-agent-notes
description: 在新增、审计、修剪、归档或评审本仓库 Agent Note 时使用；对每篇新笔记检查被 supersede 的活动记录，按未来决策价值分类 implemented 笔记，删除不再阻止有意义错误的 rejected 笔记，并应用 archived/{class} 的冻结规则。
---

# 归档 Agent Notes

在不抹除仍能指导工作的历史的前提下，缩减活动决策语料。对每篇笔记做语义判断；字数与年龄只是发现辅助，永远不是归档标准。

## 先读契约

分类前先读 [Agent Note 规则](../../notes/README.md)、[归档指令](../../notes/archived/AGENTS.md)与适用的活动 lifecycle 指令。用当前代码、配置、新笔记与入站链接，判断一篇笔记的 rationale 是否仍然拥有或约束任何东西。

## 新增笔记时检查 supersession

每篇新 Agent Note 触发一次针对"覆盖同一决策、机制或被拒替代方案"的活动笔记检索。写新笔记的同时分类每次全量/部分 supersession：符合条件的 implemented 笔记在同一提交内归档；部分 supersession 或独立有用的 rationale 保持活动并交叉链接；过时提案改为 rejected；不再阻止可信错误的 rejected 笔记删除。新属主吸收了全部独有命题时应用合并规则；不要把已知的重叠推迟到日后的语料审计。

## 按未来价值分类

按 lifecycle 分别处置：

- **implemented —— 保持活动**：笔记的 rationale、替代方案、负面保证、持久/线上语义、所有权边界、安全规则或重新引入条件，有可能指导未来变更时保留。长度无关。
- **implemented —— 归档**：发布决策已完整、正文不太可能再指导未来工作时归档。例如一次性的界面细节、窄适配器、已关闭的小缺陷、被取代的实现细节、当前行为已在别处显而易见的流程史。
- **proposed —— 永不归档**：活提案保持活动；不值得继续推进就诚实拒绝，写成满足 rejected 格式的笔记。
- **rejected —— 仅作护栏保留**：落败的提案仍是一个有诱惑力的、有意义的错误，且笔记解释了它为什么输，才保留。
- **rejected —— 删除**：被拒想法已过时、被取代、不再可信或不可能阻止 re-litigation 时，删除整个文件并修复或删除入站链接。

不按配额归档。检查范围内的每篇笔记都要看；近似的一组按同一原则分类；真正的边界情况记录判断理由，供交接。

## 校准示例

以下标准设定门槛；字数只是说明"大小不是判据"。

可归档的 implemented 笔记：已关闭的小型 UI 行为；未来设计杠杆很小的实现细节；完成的文档机制且当前生成物已是权威。

应保留的 implemented 笔记：基础性权威与持久化边界；跨产品所有权规则；持久存储与身份策略；明确写出重新引入条件的负面保证。

rejected 笔记：合并两个包的诱惑仍然存在时保留"拒绝拆包"；前提已过时就删除。

## 归档一篇 implemented 笔记

1. 把文件从 `implemented/<class>/` 移动到 `archived/<class>/`；归档路径刻意不含 `implemented`。
2. 正文不编辑。仅在 `Status: implemented` 下一行插入 `Archived: YYYY-MM-DD`（归档当日日期）。
3. 检索活动文档中的入站链接：重定向到当前权威；仅当有意引用历史时才指向归档路径；否则删除该链接。不验证、不修复归档笔记的出站链接。
4. 运行 `npm run verify:agents -- --write` 把新归档计入 `.archive-manifest.json`；清单 append-only，脚本拒绝覆盖任何已封存哈希。
5. 提交即封存：此后永不编辑、移动、翻译、重排格式或删除该文件。归档笔记仍是合法的入站链接目标，但只是历史快照，不是当前行为的权威。

## 验证与汇报

跑 `npm run verify:agents`、仓库常规校验（构建/测试）、`git diff --check`，重读完整 diff 的正确性与简洁性。汇报：保持活动的 implemented 笔记数、归档数、rejected 保留/删除数、如有被拒的 proposed 也一并汇报，以及每个真正的边界 case 及其处置理由。不声称归档笔记的出站链接有效。
