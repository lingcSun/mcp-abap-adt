# AGENTS.md — 已归档笔记

`archived/{class}/` 下的 Agent Note 是冻结的历史快照，不是当前行为的权威。永不编辑、重排格式、翻译、修复、更新、移动或删除已封存的文件；新决策与新事实写入活动笔记或当前文档。

归档变更只允许：整体移动文件、在 `Status: implemented` 下一行插入同一 `Archived: YYYY-MM-DD`、修复或删除指向它的入站链接。不检查、不修复归档笔记的出站链接。

归档操作走 [archive-agent-notes](../../skills/archive-agent-notes/SKILL.md) 工作流；封存凭据为同目录 `.archive-manifest.json`（SHA-256，append-only），回改即 `npm run verify:agents` 失败。
