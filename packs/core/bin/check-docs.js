#!/usr/bin/env node
// 문서 기계 검사 — md 표 열 수 · ID 중복 · 없는 ID 참조 · 번호 빠짐. 실행: node packs/core/bin/check-docs.js <파일|폴더…> [옵션]
/*
 * 문서 작업(documenter 등) 뒤 보고 전에 돌린다. 사람 눈으로 놓치기 쉬운 것만 본다. 내용이 맞는지는 보지 않는다.
 *   표     구분선(|---|) · 본문 줄의 열 수가 머리 줄과 다르면 오류 (셀 안의 | 는 \| 로 써야 한다)
 *   ID     정의 = 제목(# … ID) · 표 첫 칸 · 목록 첫머리(- ID, - **ID**). 그 밖에 나오면 참조
 *          같은 파일에서 두 번 정의하거나 두 파일의 제목으로 정의하면 오류 (다른 파일 표 첫 칸은 대응표로 보고 넘긴다)
 *          정의 없이 참조만 하면 오류 · 번호가 건너뛰면 주의(F-004 다음 F-006)
 * 옵션
 *   --ids REQ,A,F        검사할 ID 머리 (기본: 대문자 머리-숫자 꼴 전부, 예 REQ-ORD-012 · F-005)
 *   --defs <파일|폴더…>  ID 정의를 찾을 곳을 더한다 (참조만 있는 문서를 검사할 때 원본 정의 문서)
 *   --no-ids             표만 본다
 *   --cover <파일|폴더…> 원본에 정의된 ID 가 검사 문서에 모두 나오는지 (결정 ID 전수 옮김)
 *   --link A:B[,C:D]     A 로 시작하는 ID 를 정의한 줄(제목이면 그 절)마다 B ID 참조가 있는지 (예: 시나리오 TC 마다 결정 D)
 *   --forbid <정규식,…>  남으면 안 되는 표시 (내부 지시 라벨 등). workspace.json vars.docs.forbid 도 더한다
 *   § 참조               "§4.3" 이 가리키는 번호 제목(## 4.3 …)이 검사 문서에 있는지 (번호 제목이 하나도 없으면 보지 않는다)
 *   --json               결과를 JSON 으로
 * 종료 코드: 오류 있으면 1, 아니면 0 (주의만 있으면 0)
 */
'use strict';
const fs = require('fs');
const path = require('path');

/** 표 한 줄의 칸 수. 앞뒤 | 는 테두리, \| 는 칸 안 문자 */
function cellCount(line) {
  let t = line.trim();
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|') && !t.endsWith('\\|')) t = t.slice(0, -1);
  return t.split(/(?<!\\)\|/).length;
}

const isSep = (line) => /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/.test(line) && line.includes('-');
const isRow = (line) => line.trim().startsWith('|') || /(?<!\\)\|/.test(line);

/** 코드 블록(```) 안 줄 번호 집합 */
function fencedLines(lines) {
  const out = new Set();
  let open = false;
  lines.forEach((l, i) => { if (/^\s*(```|~~~)/.test(l)) { open = !open; out.add(i); } else if (open) out.add(i); });
  return out;
}

function checkTables(file, lines, fenced, issues) {
  for (let i = 0; i + 1 < lines.length; i++) {
    if (fenced.has(i) || fenced.has(i + 1)) continue;
    if (!isRow(lines[i]) || !isSep(lines[i + 1])) continue;
    if (i > 0 && isRow(lines[i - 1]) && !fenced.has(i - 1) && lines[i - 1].trim()) continue; // 표 중간
    const n = cellCount(lines[i]);
    const sep = cellCount(lines[i + 1]);
    if (sep !== n) issues.push({ level: 'error', file, line: i + 2, msg: `표 구분선 ${sep}칸 · 머리 줄 ${n}칸` });
    let j = i + 2;
    for (; j < lines.length && !fenced.has(j) && lines[j].trim() && isRow(lines[j]); j++) {
      const c = cellCount(lines[j]);
      if (c !== n) issues.push({ level: 'error', file, line: j + 1, msg: `표 ${c}칸 · 머리 줄 ${n}칸${c > n ? ' (셀 안의 | 는 \\| 로)' : ''}` });
    }
    i = j - 1;
  }
}

function idRegex(prefixes) {
  const head = prefixes ? `(?:${prefixes.map((p) => p.replace(/[^A-Za-z0-9]/g, '')).join('|')})` : '[A-Z][A-Z0-9]{0,7}';
  return new RegExp(`(?<![A-Za-z0-9_-])(${head}(?:-[A-Z][A-Z0-9]*)*-\\d{2,})(?![A-Za-z0-9_-])`, 'g');
}

/** 이 줄에서 정의로 보는 ID (제목 · 표 첫 칸 · 목록 첫머리). { id, heading } 또는 null */
function definedIn(line, re) {
  const first = (s) => { re.lastIndex = 0; const m = re.exec(s); return m && m.index === 0 ? m[1] : null; };
  const strip = (s) => s.replace(/^[*_`\s]+/, '');
  let m;
  let id;
  if ((m = line.match(/^#{1,6}\s+(.*)$/))) return (id = first(strip(m[1]))) ? { id, heading: true } : null;
  if ((m = line.match(/^\s*\|([^|]*)\|/)) && !isSep(line)) return (id = first(strip(m[1]))) ? { id, heading: false } : null;
  if ((m = line.match(/^\s*[-*+]\s+(.*)$/))) return (id = first(strip(m[1]))) ? { id, heading: false } : null;
  return null;
}

function scanIds(file, lines, fenced, re, defs, refs) {
  lines.forEach((line, i) => {
    if (fenced.has(i)) return;
    const d = definedIn(line, re);
    const def = d && d.id;
    if (d) (defs[def] = defs[def] || []).push({ file, line: i + 1, heading: d.heading });
    re.lastIndex = 0;
    let m;
    let skipped = false;
    while ((m = re.exec(line))) {
      if (m[1] === def && !skipped) { skipped = true; continue; }
      (refs[m[1]] = refs[m[1]] || []).push({ file, line: i + 1 });
    }
  });
}

function mdFiles(target) {
  let st;
  try { st = fs.statSync(target); } catch { return []; }
  if (st.isFile()) return target.endsWith('.md') ? [target] : [];
  const out = [];
  for (const e of fs.readdirSync(target, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    out.push(...mdFiles(path.join(target, e.name)));
  }
  return out;
}

/** "§4.3" 참조 → 번호 제목이 있는지. 제목 번호 = "## 4.3 …" · "## 4.3. …" · "## §4.3 …" */
function checkSections(fileLines, issues) {
  const nums = new Set();
  for (const { lines, fenced } of fileLines) lines.forEach((l, i) => { const m = !fenced.has(i) && l.match(/^#{1,6}\s+§?\s*(\d+(?:\.\d+)*)\.?(?:\s|$)/); if (m) nums.add(m[1]); });
  if (!nums.size) return;
  for (const { file, lines, fenced } of fileLines) {
    lines.forEach((l, i) => {
      if (fenced.has(i) || /^#{1,6}\s/.test(l)) return;
      for (const m of l.matchAll(/§\s*(\d+(?:\.\d+)*)/g)) if (!nums.has(m[1])) issues.push({ level: 'error', file, line: i + 1, msg: `§${m[1]} 이 가리키는 제목이 없음` });
    });
  }
}

/** --link A:B — A ID 를 정의한 단위(표 줄 · 목록 줄 · 제목이면 다음 같은 급 제목 전까지)에 B ID 참조가 있는지 */
function checkLinks(fileLines, pairs, issues) {
  for (const [a, b] of pairs) {
    const reA = idRegex([a]);
    const reB = idRegex([b]);
    for (const { file, lines, fenced } of fileLines) {
      lines.forEach((l, i) => {
        if (fenced.has(i)) return;
        const d = definedIn(l, reA);
        if (!d) return;
        let unit = l;
        if (d.heading) {
          const level = (l.match(/^#+/) || [''])[0].length;
          let j = i + 1;
          for (; j < lines.length && !(/^#{1,6}\s/.test(lines[j]) && lines[j].match(/^#+/)[0].length <= level); j++) unit += `\n${lines[j]}`;
        }
        reB.lastIndex = 0;
        if (!reB.test(unit)) issues.push({ level: 'error', file, line: i + 1, msg: `${d.id} 에 ${b} 참조가 없음 (--link ${a}:${b})` });
      });
    }
  }
}

/** 검사. { issues: [{ level, file, line, msg }] } */
function checkDocs(targets, { ids = true, prefixes = null, defsFrom = [], cover = [], links = [], forbid = [] } = {}) {
  const issues = [];
  const files = [...new Set(targets.flatMap(mdFiles))];
  const extra = [...new Set(defsFrom.flatMap(mdFiles))].filter((f) => !files.includes(f));
  const re = idRegex(prefixes);
  const defs = {};
  const refs = {};
  const extraDefs = {};
  const fileLines = [];
  for (const f of files) {
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    const fenced = fencedLines(lines);
    fileLines.push({ file: f, lines, fenced });
    checkTables(f, lines, fenced, issues);
    if (ids) scanIds(f, lines, fenced, re, defs, refs);
    for (const pat of forbid) {
      let rx;
      try { rx = new RegExp(pat); } catch { issues.push({ level: 'error', file: f, line: 0, msg: `--forbid 정규식이 잘못됨: ${pat}` }); continue; }
      lines.forEach((l, i) => { if (!fenced.has(i) && rx.test(l)) issues.push({ level: 'error', file: f, line: i + 1, msg: `남으면 안 되는 표시: ${(l.match(rx) || [''])[0]}` }); });
    }
  }
  checkSections(fileLines, issues);
  checkLinks(fileLines, links, issues);
  // --cover: 원본에 정의된 ID 가 검사 문서에 (정의든 참조든) 모두 나와야 한다
  if (cover.length) {
    const src = {};
    for (const f of [...new Set(cover.flatMap(mdFiles))]) {
      const lines = fs.readFileSync(f, 'utf8').split('\n');
      scanIds(f, lines, fencedLines(lines), re, src, {});
    }
    const seen = new Set();
    for (const { lines, fenced } of fileLines) lines.forEach((l, i) => { if (fenced.has(i)) return; re.lastIndex = 0; let m; while ((m = re.exec(l))) seen.add(m[1]); });
    const missing = Object.keys(src).filter((id) => !seen.has(id));
    for (const id of missing) issues.push({ level: 'error', file: src[id][0].file, line: src[id][0].line, msg: `원본의 ${id} 가 검사 문서에 없음 (--cover)` });
    if (!missing.length) issues.push({ level: 'info', file: '', line: 0, msg: `원본 ID ${Object.keys(src).length}개 모두 옮겨짐 (--cover)` });
  }
  if (ids) {
    for (const f of extra) {
      const lines = fs.readFileSync(f, 'utf8').split('\n');
      scanIds(f, lines, fencedLines(lines), re, extraDefs, {});
    }
    for (const [id, at] of Object.entries(defs)) {
      const dup = at.find((x, k) => k > 0 && at.slice(0, k).some((y) => y.file === x.file || (y.heading && x.heading)));
      if (!dup) continue;
      const prev = at.find((y) => y !== dup && (y.file === dup.file || (y.heading && dup.heading)));
      issues.push({ level: 'error', file: dup.file, line: dup.line, msg: `ID ${id} 가 두 번 정의됨 (처음: ${path.relative(process.cwd(), prev.file)}:${prev.line})` });
    }
    const known = new Set([...Object.keys(defs), ...Object.keys(extraDefs)]);
    // 정의가 하나도 없는 머리(REQ 등)는 다른 문서에 정의가 있는 것으로 보고 넘긴다. --defs 로 원본을 주면 본다
    const headOf = (id) => id.replace(/-\d+$/, '');
    const definedHeads = new Set([...known].map(headOf));
    for (const [id, at] of Object.entries(refs)) {
      if (known.has(id) || !definedHeads.has(headOf(id))) continue;
      issues.push({ level: 'error', file: at[0].file, line: at[0].line, msg: `ID ${id} 를 참조하지만 정의가 없음${at.length > 1 ? ` (${at.length}곳)` : ''}` });
    }
    const byHead = {};
    for (const id of known) (byHead[headOf(id)] = byHead[headOf(id)] || []).push(id);
    for (const [head, list] of Object.entries(byHead)) {
      const nums = list.map((x) => Number(x.slice(head.length + 1))).sort((a, b) => a - b);
      const width = list[0].length - head.length - 1;
      const gaps = [];
      for (let k = 1; k < nums.length; k++) for (let n = nums[k - 1] + 1; n < nums[k] && gaps.length < 10; n++) gaps.push(`${head}-${String(n).padStart(width, '0')}`);
      if (gaps.length) issues.push({ level: 'warn', file: (defs[list[0]] || extraDefs[list[0]])[0].file, line: 0, msg: `번호가 건너뜀: ${gaps.join(', ')} (일부러 비운 것이면 무시)` });
    }
  }
  return { files: files.length, issues };
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const valueOf = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : null; };
  const listOf = (k) => { const at = argv.indexOf(`--${k}`); const out = []; if (at >= 0) for (let i = at + 1; i < argv.length && !argv[i].startsWith('--'); i++) out.push(argv[i]); return out; };
  const defsFrom = listOf('defs');
  const cover = listOf('cover');
  const valued = new Set(['--ids', '--link', '--forbid']);
  const targets = argv.filter((a, i) => !a.startsWith('--') && !valued.has(argv[i - 1]) && !defsFrom.includes(a) && !cover.includes(a));
  const links = (valueOf('link') || '').split(',').map((x) => x.trim().split(':')).filter((x) => x.length === 2 && x[0] && x[1]);
  // 금지 표시 — 옵션 + 워크스페이스 vars.docs.forbid (쉼표로)
  let wsForbid = '';
  try { wsForbid = ((require('../lib/workspace').load().vars || {}).docs || {}).forbid || ''; } catch { /* 워크스페이스 밖 */ }
  const forbid = [...String(valueOf('forbid') || '').split(','), ...String(wsForbid).split(',')].map((x) => x.trim()).filter(Boolean);
  if (!targets.length) {
    console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(2, 19).map((l) => l.replace(/^ \* ?/, '')).join('\n'));
    process.exit(argv.length ? 1 : 0);
  }
  const prefixes = valueOf('ids') ? valueOf('ids').split(',').map((s) => s.trim()).filter(Boolean) : null;
  const r = checkDocs(targets, { ids: !argv.includes('--no-ids'), prefixes, defsFrom, cover, links, forbid });
  if (argv.includes('--json')) { console.log(JSON.stringify(r, null, 2)); process.exit(r.issues.some((x) => x.level === 'error') ? 1 : 0); }
  const errors = r.issues.filter((x) => x.level === 'error');
  const warns = r.issues.filter((x) => x.level === 'warn');
  for (const x of [...errors, ...warns]) console.log(`${x.level === 'error' ? '✖' : '⚠'} ${path.relative(process.cwd(), x.file)}${x.line ? `:${x.line}` : ''}  ${x.msg}`);
  for (const x of r.issues.filter((y) => y.level === 'info')) console.log(`✔ ${x.msg}`);
  console.log(`문서 ${r.files}개: 오류 ${errors.length} · 주의 ${warns.length}`);
  process.exit(errors.length ? 1 : 0);
}

module.exports = { checkDocs, cellCount };
