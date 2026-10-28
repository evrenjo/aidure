#!/usr/bin/env node
// 담당 repo 밖 수정 막기 (Claude Code · Codex PreToolUse): 팀원은 workspace.json team.members[].repos 의 repo 만 고친다. 팀장 · 담당 없는 repo 는 통과.
// 파일 편집(Edit · Write · MultiEdit · NotebookEdit · apply_patch)은 경로로, 셸은 명령을 나눠 실제로 쓰는 대상(쓰는 git 명령의 repo · rm · sed -i 의 파일 · cp · mv 의 대상 · > 의 파일)만 본다. 읽기 · git pull · checkout 은 통과.
// 스크립트 안에서 쓰는 것(python · make · node -e)까지는 못 본다 (실수 · AI 의 임의 수정을 막는 장치, 서버 강제는 CODEOWNERS).
// 팀원 · 서브에이전트 · 위임 세션 안에서도 돈다 (그쪽도 같은 사람의 수정이다). 판정: packs/core/lib/team.js. 예외는 삼키고 항상 exit 0
'use strict';
const os = require('os');
const path = require('path');

// 쓰는 git 하위 명령 (pull · fetch · checkout · switch · stash 는 읽는 사본을 맞추는 일이라 통과)
const GIT_WRITE = new Set(['commit', 'push', 'add', 'rm', 'mv', 'reset', 'restore', 'merge', 'rebase', 'cherry-pick', 'revert', 'apply', 'am', 'tag', 'clean']);
// 인자가 곧 쓰는 대상인 명령
const ARG_WRITE = new Set(['rm', 'rmdir', 'touch', 'mkdir', 'truncate', 'tee', 'chmod', 'chown']);
// 마지막 인자가 쓰는 대상인 명령
const LAST_WRITE = new Set(['cp', 'mv', 'ln', 'install', 'rsync']);
// 그 폴더에서 돌면 파일을 바꾸는 명령
const PKG_WRITE = /^(?:npm|pnpm|yarn|bun)$/;

const WRAP = new Set(['sudo', 'env', 'nohup', 'time', 'command', 'exec', 'xargs', 'nice']);

/** 명령 줄을 단위 명령으로 — ; · && · || · | · 괄호 · 줄바꿈, 따옴표 안은 그대로 */
function segments(cmd) {
  const out = [];
  let cur = '';
  let q = null;
  const s = String(cmd);
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { cur += c; if (c === q) q = null; else if (c === '\\' && q === '"' && i + 1 < s.length) cur += s[++i]; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === '\\' && i + 1 < s.length) { cur += c + s[++i]; continue; }
    if (c === '\n' || c === ';' || c === '(' || c === ')' || c === '|' || (c === '&' && s[i + 1] === '&')) {
      out.push(cur); cur = '';
      if ((c === '|' && s[i + 1] === '|') || c === '&') i++;
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

/** 셸 낱말 나누기 (따옴표 · 이스케이프). 리다이렉트는 '>' 낱말로 */
function tokens(seg) {
  const out = [];
  let cur = '';
  let q = null;
  let has = false;
  for (let i = 0; i < seg.length; i++) {
    const c = seg[i];
    if (q) { if (c === q) q = null; else if (c === '\\' && q === '"' && i + 1 < seg.length) cur += seg[++i]; else cur += c; continue; }
    if (c === '"' || c === "'") { q = c; has = true; continue; }
    if (c === '\\' && i + 1 < seg.length) { cur += seg[++i]; has = true; continue; }
    if (/\s/.test(c)) { if (cur || has) out.push(cur); cur = ''; has = false; continue; }
    if (c === '>') {
      if ((cur || has) && !/^\d$/.test(cur)) out.push(cur);
      cur = ''; has = false;
      if (seg[i + 1] === '>') i++;
      if (seg[i + 1] === '&') { i++; while (i + 1 < seg.length && /[\d-]/.test(seg[i + 1])) i++; continue; } // 2>&1 같은 돌려쓰기
      out.push('>');
      continue;
    }
    cur += c;
  }
  if (cur || has) out.push(cur);
  return out;
}

/** 명령 → 쓰는 대상 경로 목록 (cd 를 따라 현재 폴더를 바꾼다) */
function writeTargets(cmd, cwd) {
  const home = os.homedir();
  const abs = (p, base) => path.resolve(base, String(p).replace(/^~(?=\/|$)/, home));
  const out = [];
  let dir = cwd;
  // 줄바꿈 · ; · && · || · | · 괄호로 나눈다 (따옴표 안은 나누지 않는다. heredoc 본문은 대충 넘어간다)
  for (const raw of segments(cmd)) {
    const t = tokens(raw.trim());
    if (!t.length) continue;
    for (let i = 0; i < t.length; i++) if (t[i] === '>' && t[i + 1] && t[i + 1] !== '/dev/null') out.push(abs(t[i + 1], dir));
    const w = t.filter((x, i) => x !== '>' && t[i - 1] !== '>');
    let k = 0;
    // VAR=값 앞붙이기와 감싸는 명령(sudo · env · nohup · time · command · exec · xargs)은 건너뛴다
    for (;;) {
      if (k < w.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(w[k])) { k++; continue; }
      if (k < w.length && WRAP.has(path.basename(w[k]))) { k++; while (k < w.length && w[k].startsWith('-')) k++; continue; }
      break;
    }
    const name = path.basename(w[k] || '');
    const args = w.slice(k + 1);
    if (name === 'cd' || name === 'pushd') { if (args[0] && args[0] !== '-') dir = abs(args[0], dir); continue; }
    if (name === 'find' && args.some((a) => a === '-delete' || a === '-exec' || a === '-execdir')) { out.push(abs(args.find((a) => !a.startsWith('-')) || '.', dir)); continue; }
    if (name === 'git') {
      let repo = dir;
      let j = 0;
      while (j < args.length && args[j].startsWith('-')) {
        if (args[j] === '-C') { repo = abs(args[j + 1] || '.', repo); j += 2; } else if (args[j] === '-c') j += 2; else j++;
      }
      if (GIT_WRITE.has(args[j])) out.push(repo);
      continue;
    }
    const files = args.filter((x) => !x.startsWith('-'));
    if (ARG_WRITE.has(name)) out.push(...files.map((f) => abs(f, dir)));
    else if (LAST_WRITE.has(name) && files.length >= 2) out.push(abs(files[files.length - 1], dir));
    else if (name === 'sed' && args.some((a) => /^-[a-zA-Z]*i/.test(a) || a === '--in-place')) {
      // sed [-i ''] [-e 스크립트…] 스크립트? 파일… — 빈 인자(macOS -i '')와 -e 의 스크립트는 파일이 아니다
      const fs2 = args.filter((x, i) => x !== '' && !x.startsWith('-') && !['-e', '-f'].includes(args[i - 1]));
      out.push(...(args.includes('-e') || args.includes('-f') ? fs2 : fs2.slice(1)).map((f) => abs(f, dir)));
    }
    else if (name === 'perl' && args.some((a) => /^-\S*i/.test(a))) out.push(...files.slice(1).map((f) => abs(f, dir)));
    else if (PKG_WRITE.test(name) && args.some((a) => /^(?:i|install|add|remove|uninstall|update|ci)$/.test(a))) {
      const pi = args.findIndex((a) => a === '--prefix' || a === '--cwd' || a === '-C' || a === '--dir');
      out.push(pi >= 0 && args[pi + 1] ? abs(args[pi + 1], dir) : dir);
    }
    else if ((name === 'prettier' || name === 'eslint') && args.some((a) => /^--(?:write|fix)$/.test(a))) out.push(...(files.length ? files.map((f) => abs(f, dir)) : [dir]));
  }
  return out;
}

function main() {
  const { readInput, deny, root } = require('../lib/hook');
  const team = require('../lib/team');
  const { load } = require('../lib/workspace');
  const input = readInput();
  const R = root();
  const ws = load(R);
  if (!ws || !ws.team) return;
  const who = team.whoAmI(R, ws);
  if (who.lead) return;
  const tool = String(input.tool_name || '');
  const ti = input.tool_input || {};
  const cwd = input.cwd || R;
  const check = (file) => {
    const repo = team.repoOfPath(R, ws, path.resolve(cwd, file));
    if (!repo) return null;
    const acc = team.repoAccess(R, ws, repo, who);
    return acc.ok ? null : team.blockMessage(repo, acc);
  };
  let msg = null;
  if (/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(tool)) msg = check(ti.file_path || ti.notebook_path);
  else if (tool === 'apply_patch' || (tool !== 'Bash' && typeof ti.command === 'string' && /\*\*\* (Add|Update|Delete) File:/.test(ti.command))) {
    for (const m of String(ti.command || ti.patch || '').matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+)$|^\*\*\* Move to: (.+)$/gm)) {
      msg = check((m[1] || m[2]).trim());
      if (msg) break;
    }
  } else if (tool === 'Bash') {
    for (const t of writeTargets(ti.command || '', cwd)) { msg = check(t); if (msg) break; }
  }
  if (msg) deny(`${msg}. (설정: workspace.json team.members[].repos, 확인: kedovi team whoami)`);
}

if (require.main === module) {
  try { main(); } catch { /* 훅은 세션을 깨지 않는다 */ }
  process.exit(0);
}
module.exports = { writeTargets, tokens, segments };
