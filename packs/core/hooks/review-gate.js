#!/usr/bin/env node
// PreToolUse(Bash) 훅 (Claude Code) — git commit · push 전에 리뷰를 거쳤는지 본다. 기본 꺼짐. warn 이면 한 줄 알리고 통과, block 이면 막는다. 항상 exit 0
/*
 * 대상: workspace.json repos 의 코드 · 기획 repo (agents.enforce.reviewRepos). 워크스페이스 repo 자체(핸드오프 · 설정)는 보지 않는다.
 * 판정: 리뷰 기록 · 이미 push 된 상태와 비교해 리뷰 안 된 줄 수가 기준(reviewMinLines)을 넘으면 알린다. 계산은 lib/review.js
 * 생략: 사용자가 승인하면 리더가 aikit review skip --reason "<사유>" 로 한 번만 쓰는 표시를 남긴다.
 * 명령 문자열에서 git commit · push 와 폴더(cd <폴더> && · git -C <폴더>)를 찾는다. 알아보지 못하면 조용히 통과한다 (잘못 막지 않는다).
 */
'use strict';
const path = require('path');
const { run, readInput, deny, root } = require('../lib/hook');

const GIT = /(?:^|[;&|(]\s*)(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)*git((?:\s+-C\s+(?:"[^"]+"|'[^']+'|\S+)|\s+-c\s+\S+|\s+--(?:no-pager|git-dir|work-tree)(?:=\S+)?)*)\s+(commit|push)\b([^;&|]*)/;
const unquote = (s) => String(s || '').replace(/^["']|["']$/g, '');

run(() => {
  const input = readInput();
  if (String(input.tool_name || '') !== 'Bash') return;
  const cmd = String((input.tool_input || {}).command || '');
  const m = cmd.match(GIT);
  if (!m || /\s--dry-run\b|\s--help\b|\s-h\b/.test(m[3])) return;
  const ROOT = root();
  const R = require('../lib/review');
  const st = R.settings(ROOT);
  if (st.level === 'off') return;
  // 폴더: 세션 cwd → git 앞의 마지막 cd → git -C
  let dir = input.cwd || ROOT;
  const before = cmd.slice(0, m.index + 1);
  const cds = [...before.matchAll(/(?:^|[;&|(]\s*)cd\s+("[^"]+"|'[^']+'|[^\s;&|]+)/g)];
  if (cds.length) dir = path.resolve(dir, unquote(cds[cds.length - 1][1]));
  const c = m[1].match(/-C\s+("[^"]+"|'[^']+'|\S+)/);
  if (c) dir = path.resolve(dir, unquote(c[1]));
  const ws = require('../lib/workspace').load(ROOT);
  const repo = R.repoOf(ws, st, dir);
  if (!repo) return;
  const res = R.measure(ROOT, repo, st, m[2]);
  if (!res || res.unreviewed <= st.minLines) return;
  if (st.level !== 'block' && R.warnedAlready(ROOT, repo.name, res.tree)) return;
  const skip = R.takeSkip(ROOT, repo.name);
  if (skip) return;
  const msg = `리뷰 확인: ${repo.name} 에 리뷰를 거치지 않은 변경이 ${res.unreviewed}줄 있습니다${st.minLines ? ` (기준 ${st.minLines}줄)` : ''}${res.last ? `. 마지막 리뷰 ${R.when(res.last.at)}${res.last.by ? ` (${res.last.by})` : ''} 뒤에 바뀐 만큼입니다` : ''}. ` +
    `${m[2]} 전에 리뷰를 거칩니다 (review 스킬 · reviewer 역할 에이전트 · 다른 AI 에게 위임). 코드뿐 아니라 문서도 같습니다. ` +
    '이미 다른 방법으로 리뷰했으면 aikit review mark, 생략은 사용자에게 먼저 묻고 승인받았을 때만 aikit review skip --reason "<사유>". 지금 상태: aikit review status';
  if (st.level === 'block') return deny(msg);
  R.markWarned(ROOT, repo.name, res.tree);
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: `⚠ ${msg}` } }));
});
