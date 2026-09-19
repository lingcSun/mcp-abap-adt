#!/usr/bin/env node
/**
 * verify-agents — .agents 体系的机械门禁。
 *
 * 校验的可机械判定不变量：
 *   1. 根 AGENTS.md 字符预算：必须携带「本文件预算 ≤ N 字符」条款，实际字符数（code points）不超 N；
 *   2. Agent Note 格式：文件头三行、Status 与所在 lifecycle 目录一致、文件名日期前缀、类别封闭集、
 *      各生命周期的骨架段；
 *   3. 链接：.agents/ 全树与根 AGENTS.md 里的相对 markdown 链接全部可达（跳过行内代码与 http/#/mailto）；
 *   4. 归档冻结：archived 笔记由 `.agents/notes/archived/.archive-manifest.json` 的 SHA-256 清单封存，
 *      清单与文件一一对应、append-only；`--write` 仅新增缺失条目，拒绝覆盖任何已封存哈希。
 *
 * 语义判断（rationale 是否诚实、归档时机、supersession 分类）不在此列，由评审与 archive-agent-notes 技能把关。
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve, basename, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;
const fail = (msg) => {
  console.error(`FAIL: ${msg}`);
  failures++;
};
const rel = (f) => relative(repoRoot, f).replaceAll("\\", "/");
const writeMode = process.argv.includes("--write");

// ---- 1. 根 AGENTS.md 字符预算 ----
const agentsPath = resolve(repoRoot, "AGENTS.md");
const agentsText = readFileSync(agentsPath, "utf8");
const budget = agentsText.match(/本文件预算 ≤ (\d+) 字符/);
if (!budget) {
  fail("AGENTS.md 缺少预算条款（本文件预算 ≤ N 字符）");
} else {
  const limit = Number(budget[1]);
  const chars = [...agentsText].length;
  if (chars > limit) fail(`AGENTS.md ${chars} 字符，超出预算 ${limit}`);
}

// ---- 遍历 .agents 下全部 markdown ----
function collect(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = resolve(dir, e.name);
    if (e.isDirectory()) out.push(...collect(p));
    else if (e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

const LIFECYCLES = new Set(["proposed", "implemented", "rejected", "archived"]);
const CLASSES = new Set([
  "feature",
  "bug-fix",
  "simplification",
  "architecture",
  "process",
  "testing",
]);
const NOTE_NAME = /^\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.md$/;
const RESERVED = new Set(["AGENTS.md", "README.md", "CLAUDE.md"]);
const notesDir = resolve(repoRoot, ".agents", "notes");
const archivedDir = resolve(notesDir, "archived");

// 反索引：目录树即清单，禁止集中式 INDEX
if (existsSync(resolve(notesDir, "INDEX.md")))
  fail("notes/INDEX.md 不允许存在：目录树本身就是清单");

// ---- 3. 链接检查 ----
function checkLinks(f, text) {
  // 行内代码里是格式示例不是真链接；先剥离再提取
  const stripped = text.replace(/`[^`\n]*`/g, "");
  for (const [, link] of stripped.matchAll(/\]\(([^)\s]+)\)/g)) {
    if (/^(https?:|#|mailto:)/.test(link)) continue;
    const target = resolve(dirname(f), link.split("#")[0]);
    if (relative(repoRoot, target).startsWith(".."))
      // 兄弟仓库在本机存在时会"假可达"，隔离 checkout（CI）必死链；
      // 跨仓库引用一律用绝对 GitHub URL
      fail(`${rel(f)}: 链接逃出仓库根 -> ${link}`);
    else if (!existsSync(target)) fail(`${rel(f)}: 断链 -> ${link}`);
  }
}

// ---- 2. Agent Note 格式 ----
function checkNote(f, lifecycle) {
  const text = readFileSync(f, "utf8");
  const lines = text.split(/\r?\n/);
  const name = rel(f);
  if (!RESERVED.has(basename(f)) && !NOTE_NAME.test(basename(f)))
    fail(`${name}: 文件名须为 yyyy-mm-dd-topic-title.md（小写连字符）`);
  if (!lines[0].startsWith("# Agent Note: "))
    fail(`${name}: 首行须为 "# Agent Note: <标题>"`);
  if (lines[1] !== "") fail(`${name}: 第二行须为空行`);
  const m = lines[2]?.match(/^Status: (implemented|proposed|rejected — .+)$/);
  if (!m) {
    fail(`${name}: 第三行须为 "Status: implemented|proposed|rejected — <原因>"`);
    return;
  }
  const status = m[1].split(" —")[0];
  if (lifecycle === "archived") {
    if (status !== "implemented")
      fail(`${name}: archived 笔记的 Status 须为 implemented`);
    if (!/^Archived: \d{4}-\d{2}-\d{2}$/m.test(text))
      fail(`${name}: archived 笔记缺 "Archived: YYYY-MM-DD" 行`);
  } else if (status !== lifecycle) {
    fail(`${name}: Status '${status}' 与目录 '${lifecycle}' 不一致`);
  }
  if (!text.includes("## Problem")) fail(`${name}: 缺 ## Problem`);
  if (!text.includes("## Alternatives considered"))
    fail(`${name}: 缺 ## Alternatives considered`);
  if (status === "implemented") {
    if (!text.includes("## Decision")) fail(`${name}: implemented 缺 ## Decision`);
    if (!text.includes("## Consequences"))
      fail(`${name}: implemented 缺 ## Consequences`);
    if (text.includes("## Proposal"))
      fail(`${name}: implemented 不得含规格腔的 ## Proposal`);
    if (text.includes("## Acceptance criteria"))
      fail(`${name}: implemented 不得含 ## Acceptance criteria`);
  }
}

const files = existsSync(resolve(repoRoot, ".agents"))
  ? collect(resolve(repoRoot, ".agents"))
  : [];
const archivedNotes = [];
for (const f of files) {
  const text = readFileSync(f, "utf8");
  checkLinks(f, text);
  const relToNotes = relative(notesDir, f);
  if (relToNotes.startsWith("..")) continue; // skills 等只查链接
  const segs = relToNotes.split(/[\\/]/);
  const lifecycle = segs[0];
  if (!LIFECYCLES.has(lifecycle)) continue; // notes 根下的 README/AGENTS
  if (segs.length === 2) continue; // lifecycle 根下的保留文件（AGENTS.md 等）
  const [cls, name] = segs.slice(1);
  if (RESERVED.has(name)) continue;
  if (!CLASSES.has(cls))
    fail(`${rel(f)}: 类别 '${cls}' 不在封闭集（${[...CLASSES].join("/")}）`);
  checkNote(f, lifecycle);
  if (lifecycle === "archived") archivedNotes.push(f);
}

// ---- 4. 归档冻结清单（append-only） ----
const manifestPath = resolve(archivedDir, ".archive-manifest.json");
const hashOf = (f) => createHash("sha256").update(readFileSync(f)).digest("hex");
const keyOf = (f) => relative(archivedDir, f).replaceAll("\\", "/");
if (archivedNotes.length > 0 && !existsSync(manifestPath)) {
  if (writeMode) {
    const files = {};
    for (const f of archivedNotes) files[keyOf(f)] = hashOf(f);
    writeFileSync(manifestPath, JSON.stringify({ files }, null, 2) + "\n");
    console.log(`archive manifest: 建立并封存 ${archivedNotes.length} 篇`);
  } else {
    fail(
      "archived 下已有笔记但缺 .archive-manifest.json：运行 npm run verify:agents -- --write 建立封存清单",
    );
  }
} else if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.files ??= {};
  const listed = new Map(Object.entries(manifest.files));
  const present = new Map(archivedNotes.map((f) => [keyOf(f), f]));
  for (const [entry, hash] of listed) {
    const f = resolve(archivedDir, entry);
    if (!present.has(entry)) {
      fail(`${entry}: 清单有条目但文件不存在——归档笔记永不删除`);
    } else if (hashOf(f) !== hash) {
      fail(`${entry}: 内容与封存哈希不符——归档笔记永不回改（git checkout 恢复）`);
    }
  }
  const missing = [...present.keys()].filter((k) => !listed.has(k));
  if (missing.length > 0) {
    if (writeMode) {
      for (const k of missing) manifest.files[k] = hashOf(present.get(k));
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
      console.log(`archive manifest: 新增封存 ${missing.length} 篇`);
    } else {
      fail(
        `${missing.join(", ")} 未计入封存清单：npm run verify:agents -- --write`,
      );
    }
  }
}
checkLinks(agentsPath, agentsText);

if (failures > 0) {
  console.error(`verify-agents: ${failures} 处不合格`);
  process.exit(1);
}
console.log("verify-agents: ALL OK");
