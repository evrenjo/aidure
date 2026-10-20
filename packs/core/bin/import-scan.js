#!/usr/bin/env node
// 기존 AI 작업 폴더 훑기 — 이 워크스페이스로 옮길 것을 분류해 보고한다. 읽기만 한다 (옮기기는 import 스킬 절차로, 계획을 사용자에게 보여 주고 승인 뒤에)
/*
 * 사용법: node packs/core/bin/import-scan.js <폴더> [--json]
 * 분류: 지침 · 룰 / 스킬 · 명령 · 역할 / 메모 / 핸드오프 · 할 일 / 훅 · 설정 / 스크립트 / 큰 폴더(산출물 후보)
 * 따로 모으는 것: 문서 속 절대경로(개인 폴더) · 비밀값 의심 줄 (값은 찍지 않는다)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SKIP = new Set(['.git', 'node_modules', '.venv', 'venv', '__pycache__', '.idea', '.vscode', 'dist', 'build', 'target', '.next', '.gradle']);
const TEXT = /\.(md|mdc|txt|json|ya?ml|toml|sh|py|js|ts|sql|properties|env|xml|ini|cfg|conf)$/i;
const MAX_FILES = 20000;
const MAX_READ = 512 * 1024;
const BIG_FILES = 200; // 파일 수나 크기가 이보다 크면 산출물 후보로 본다
const BIG_BYTES = 1024 * 1024;

const ABS = /(\/Users\/[^/\s"'`)]+|\/home\/[^/\s"'`)]+|[A-Za-z]:\\Users\\[^\\\s"'`)]+)/g;
const SECRET = [
  /(pass(word|wd)?|비밀번호|암호|secret|token|api[_-]?key|access[_-]?key|private[_-]?key)\s*["']?\s*[:=]\s*["']?[^\s"'<>{}$]{4,}/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b(AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|glpat-[A-Za-z0-9_-]{16,}|xox[baprs]-[A-Za-z0-9-]{10,}|sk-[A-Za-z0-9_-]{20,})\b/,
  /\b\d{8,10}:[A-Za-z0-9_-]{30,}\b/, // 텔레그램 봇 토큰 꼴
];
const PLACEHOLDER = /[:=]\s*["']?(\*+|x{3,}|<[^>]*>|\.{3}|…|changeme|todo|없음|null|none|true|false)["']?\s*$/i;

function kindOf(rel) {
  const p = rel.split(path.sep).join('/');
  const base = path.basename(p);
  if (/^(CLAUDE|AGENTS|GEMINI)(\.local|\.override)?\.md$/i.test(base) || /^\.(cursorrules|windsurfrules)$/.test(base) || /(^|\/)\.(claude|cursor|agents|codex)\/rules\//.test(p) || /(^|\/)\.github\/copilot-instructions\.md$/.test(p)) return 'rules';
  if (/(^|\/)\.(claude|codex|agents)\/(skills|commands|agents|prompts)\//.test(p)) return 'skills';
  if (/(^|\/)(\.serena\/memories|memory|memories)\//.test(p)) return 'memory';
  if (/(^|\/)handoffs?\//i.test(p) || /^(HANDOFF|TODO|LATEST)[^/]*\.md$/i.test(base)) return 'handoff';
  if (/(^|\/)\.(claude|codex)\/[^/]*\.(json|toml)$/.test(p) || /(^|\/)\.mcp\.json$/.test(p) || /(^|\/)\.(claude|codex)\/hooks\//.test(p)) return 'config';
  if (/\.(py|sh|js|ts|rb|ps1|bat)$/i.test(base)) return 'scripts';
  if (/\.(md|mdc|txt)$/i.test(base)) return 'docs';
  return 'other';
}

/** 룰 파일의 머리말에서 읽는 조건(경로 · 설명)이 있는가: 있으면 필요할 때 읽는 룰 후보 */
function ruleHint(text, rel) {
  const head = (text.match(/^---\n([\s\S]*?)\n---/) || [])[1] || '';
  if (/^(paths|globs|when|description)\s*:/m.test(head) && !/alwaysApply\s*:\s*true/.test(head)) return '필요할 때 읽는 룰 후보 (읽는 조건이 적혀 있음)';
  if (/^(CLAUDE|AGENTS|GEMINI)/i.test(path.basename(rel))) return '상시 지침: 줄마다 상시 · 필요 시 · 버림으로 나눈다';
  return text.length > 4000 ? '길다(4KB 초과): 필요할 때 읽는 룰 후보' : '상시 룰 후보';
}

function scan(root) {
  const files = [];
  const dirs = new Map(); // 최상위에서 두 단계까지의 폴더별 파일 수 · 크기
  let truncated = false;
  const walk = (dir) => {
    let names = [];
    try { names = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of names) {
      if (files.length >= MAX_FILES) { truncated = true; return; }
      const full = path.join(dir, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(full); continue; }
      if (!e.isFile()) continue;
      let size = 0;
      try { size = fs.statSync(full).size; } catch { continue; }
      const rel = path.relative(root, full);
      files.push({ rel, size, kind: kindOf(rel) });
      const parts = rel.split(path.sep);
      for (let d = 1; d <= Math.min(2, parts.length - 1); d += 1) {
        const key = parts.slice(0, d).join('/');
        const cur = dirs.get(key) || { files: 0, bytes: 0 };
        cur.files += 1; cur.bytes += size;
        dirs.set(key, cur);
      }
    }
  };
  walk(root);

  const absPaths = new Map(); // 경로 머리 → { count, files }
  const secrets = [];
  for (const f of files) {
    if (!TEXT.test(f.rel) && !/^(CLAUDE|AGENTS)/.test(path.basename(f.rel)) && !/^\.env/.test(path.basename(f.rel))) continue;
    if (f.size > MAX_READ) continue;
    let text = '';
    try { text = fs.readFileSync(path.join(root, f.rel), 'utf8'); } catch { continue; }
    if (f.kind === 'rules') f.hint = ruleHint(text, f.rel);
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      for (const m of line.match(ABS) || []) {
        const cur = absPaths.get(m) || { count: 0, files: new Set() };
        cur.count += 1; cur.files.add(f.rel);
        absPaths.set(m, cur);
      }
      if (line.length < 400 && SECRET.some((re) => re.test(line)) && !PLACEHOLDER.test(line.trim())) {
        const name = (line.match(/[A-Za-z가-힣_.-]*(pass(word|wd)?|비밀번호|암호|secret|token|key)[A-Za-z_.-]*/i) || ['비밀값 꼴'])[0];
        secrets.push({ file: f.rel, line: i + 1, what: name.slice(0, 40) });
      }
    });
  }

  // 큰 폴더: 더 큰 상위 폴더가 이미 잡혔으면 하위는 뺀다
  const big = [...dirs.entries()].filter(([, v]) => v.files >= BIG_FILES || v.bytes >= BIG_BYTES).map(([dir, v]) => ({ dir, ...v }))
    .filter((d, _, all) => !all.some((o) => o.dir !== d.dir && d.dir.startsWith(`${o.dir}/`)));
  const inBig = (rel) => big.some((b) => rel.split(path.sep).join('/').startsWith(`${b.dir}/`));
  const groups = {};
  for (const f of files) {
    if (f.kind === 'other' || (inBig(f.rel) && !['rules', 'skills', 'config'].includes(f.kind))) continue;
    (groups[f.kind] = groups[f.kind] || []).push({ file: f.rel, size: f.size, ...(f.hint ? { hint: f.hint } : {}) });
  }
  return {
    root,
    total: { files: files.length, bytes: files.reduce((n, f) => n + f.size, 0), truncated },
    groups,
    big,
    absPaths: [...absPaths.entries()].map(([p, v]) => ({ path: p, count: v.count, files: [...v.files].slice(0, 20) })).sort((a, b) => b.count - a.count),
    secrets,
  };
}

const kb = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);
const TITLES = {
  rules: ['지침 · 룰', '겹치는 것은 버리고, 프로젝트 사실은 packs/project/rules/ 로 (상시 · 필요할 때 읽기 구분)'],
  skills: ['스킬 · 명령 · 역할', 'packs/project/skills/ 로. 킷 기본 스킬과 같은 일이면 옮기지 않는다'],
  memory: ['메모', '아직 맞는 사실만 골라 룰이나 문서로. 통째로 옮기지 않는다'],
  handoff: ['핸드오프 · 할 일', 'handoffs/<내 id>/ 로 (handoff 스킬 형식)'],
  config: ['훅 · 설정', '킷이 만드는 설정과 겹친다. 필요한 것만 팩 훅이나 개인 설정으로'],
  scripts: ['스크립트', '팀이 쓰는 도구는 packs/project/bin/, 개인 1회용은 scripts/'],
  docs: ['그 밖의 문서', '참조 자료면 기획 repo 나 packs/project/ 로, 낡았으면 두고 온다'],
};

function report(r) {
  const out = [`기존 폴더 훑기: ${r.root}`, `파일 ${r.total.files}개 · ${kb(r.total.bytes)}${r.total.truncated ? ` (파일이 많아 ${MAX_FILES}개까지만 봤다)` : ''}`, ''];
  for (const [kind, [title, where]] of Object.entries(TITLES)) {
    const list = r.groups[kind] || [];
    if (!list.length) continue;
    out.push(`■ ${title} ${list.length}개: ${where}`);
    for (const f of list.slice(0, 40)) out.push(`  ${f.file} (${kb(f.size)})${f.hint ? ` · ${f.hint}` : ''}`);
    if (list.length > 40) out.push(`  … 외 ${list.length - 40}개 (--json 으로 전부)`);
    out.push('');
  }
  if (r.big.length) {
    out.push('■ 큰 폴더 (산출물 후보): 다시 만들 수 있으면 옮기지 않고 만드는 스크립트만 옮긴다');
    for (const b of r.big) out.push(`  ${b.dir}/ 파일 ${b.files}개 · ${kb(b.bytes)}`);
    out.push('');
  }
  if (r.absPaths.length) {
    out.push('■ 문서 속 개인 폴더 절대경로: 옮길 때 워크스페이스 기준 상대 경로로 바꾼다');
    for (const a of r.absPaths.slice(0, 20)) out.push(`  ${a.path} ${a.count}곳 (${a.files.slice(0, 3).join(', ')}${a.files.length > 3 ? ' …' : ''})`);
    out.push('');
  }
  if (r.secrets.length) {
    out.push(`■ 비밀값 의심 줄 ${r.secrets.length}곳: 옮기지 않는다. 필요한 값은 aikit secret 으로 (값은 여기 찍지 않는다)`);
    for (const s of r.secrets.slice(0, 40)) out.push(`  ${s.file}:${s.line} (${s.what})`);
    if (r.secrets.length > 40) out.push(`  … 외 ${r.secrets.length - 40}곳`);
    out.push('');
  }
  out.push('다음: 이 보고로 옮길 계획(무엇을 어디로 · 버릴 것 · 바꿀 경로)을 표로 만들어 사용자에게 보여 주고 승인받은 뒤 옮긴다 (import 스킬)');
  return out.join('\n');
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const dir = args.find((a) => !a.startsWith('--'));
  if (!dir) { console.error('사용법: node packs/core/bin/import-scan.js <폴더> [--json]'); process.exit(1); }
  const root = path.resolve(dir);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) { console.error(`폴더가 없습니다: ${root}`); process.exit(1); }
  const r = scan(root);
  console.log(args.includes('--json') ? JSON.stringify(r, null, 2) : report(r));
}

module.exports = { scan, report, kindOf };
