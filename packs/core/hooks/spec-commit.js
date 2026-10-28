#!/usr/bin/env node
// PreToolUse(Bash) 훅 (Claude Code): 코드 repo 에서 git commit 하기 전에 새 진입 파일 중 기획 ID(@spec) 가 없는 것을 한 줄로 알린다. 막지 않는다. 항상 exit 0
/*
 * 계산은 docs-site.js trace --new (커밋 안 한 파일 + push 안 한 커밋의 진입 파일). 기획 repo 가 없거나 vars.docs.traceOnCommit 이 off 면 조용하다.
 * 명령 문자열에서 git commit 과 폴더(cd <폴더> && · git -C <폴더>)를 찾는다 (review-gate.js 와 같은 방식). 알아보지 못하면 조용히 통과한다.
 */
'use strict';
const path = require('path');
const { spawnSync } = require('child_process');
const { run, readInput, note, root } = require('../lib/hook');

const GIT = /(?:^|[;&|(]\s*)(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)*git((?:\s+-C\s+(?:"[^"]+"|'[^']+'|\S+)|\s+-c\s+\S+|\s+--(?:no-pager|git-dir|work-tree)(?:=\S+)?)*)\s+commit\b([^;&|]*)/;
const unquote = (s) => String(s || '').replace(/^["']|["']$/g, '');

run(() => {
  const input = readInput();
  if (String(input.tool_name || '') !== 'Bash') return;
  const cmd = String((input.tool_input || {}).command || '');
  const m = cmd.match(GIT);
  if (!m || /\s--dry-run\b|\s--help\b|\s-h\b/.test(m[2])) return;
  const ROOT = root();
  const ws = require('../lib/workspace').load(ROOT);
  if (String(((ws.vars || {}).docs || {}).traceOnCommit || 'warn') === 'off') return;
  if (!ws.repos.some((r) => r.kind === 'docs')) return;
  let dir = input.cwd || ROOT;
  const cds = [...cmd.slice(0, m.index + 1).matchAll(/(?:^|[;&|(]\s*)cd\s+("[^"]+"|'[^']+'|[^\s;&|]+)/g)];
  if (cds.length) dir = path.resolve(dir, unquote(cds[cds.length - 1][1]));
  const c = m[1].match(/-C\s+("[^"]+"|'[^']+'|\S+)/);
  if (c) dir = path.resolve(dir, unquote(c[1]));
  const repo = ws.repos.find((r) => r.kind === 'code' && (path.resolve(dir) + path.sep).startsWith(path.resolve(r.dir) + path.sep));
  if (!repo) return;
  const r = spawnSync(process.execPath, [path.join(ROOT, 'packs', 'core', 'bin', 'docs-site.js'), 'trace', '--new'], { cwd: ROOT, encoding: 'utf8', timeout: 20000 });
  const out = String(r.stdout || '');
  if (!/기획 ID 가 없는 새 진입 파일/.test(out)) return;
  const files = out.split('\n').map((l) => l.trim()).filter((l) => l.startsWith(`${repo.name}/`));
  if (!files.length) return;
  note(`⚠ 기획 ID(@spec) 가 없는 새 진입 파일 ${files.length}개: ${files.slice(0, 8).join(', ')}${files.length > 8 ? ` 외 ${files.length - 8}개` : ''}. 커밋 전에 머리 주석에 // @spec <기능 ID> 를 달거나, 기획에 없는 기능이면 사용자에게 확인한다 (끄기: vars.docs.traceOnCommit off)`);
});
