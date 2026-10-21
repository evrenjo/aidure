#!/usr/bin/env node
// 착수 전 확인 점검 (Claude Code) — 요청마다 코드 repo 의 첫 수정(Edit · Write) 전에 답변에 「착수 전 확인:」 머리말이 있었는지 본다
/*
 * UserPromptSubmit: 이번 요청의 알림 기록을 지운다 · PreToolUse(Edit|Write|MultiEdit|NotebookEdit): 판정
 * - 대상: workspace.json 의 코드 repo(kind code) 안 파일. 워크스페이스 기록(handoffs · topics) · 기획 repo · 워크스페이스 밖은 보지 않는다
 * - 예외: 문서 · 스타일 파일(md · txt · css 등)의 두 줄 이하 수정
 * - 머리말은 이번 요청과 바로 앞 요청의 답변에서 찾는다 (계획을 보이고 「진행해」 를 받은 경우)
 * - 수준 agents.enforce.planFirst: warn(기본) = 요청마다 한 번 알림(도구는 그대로 돈다) · block = 머리말을 보일 때까지 수정을 막는다
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { readInput, deny, note, run, root, safeId } = require('../lib/hook');
const { stateDir, load } = require('../lib/workspace');

const HEADER = /착수 전 확인\s*:/;
const LIGHT = /\.(md|mdx|markdown|txt|rst|adoc|css|scss|sass|less)$/i;
const lineCount = (s) => (typeof s === 'string' && s ? s.replace(/\n$/, '').split('\n').length : 0);

/** 링크(repos/<이름> → 다른 곳)를 풀어 비교한다. 새 파일이면 폴더를 푼다 */
function real(p) {
  try { return fs.realpathSync(p); } catch { try { return path.join(fs.realpathSync(path.dirname(p)), path.basename(p)); } catch { return p; } }
}

/** 바꾸는 줄 수 (Edit = 옛 · 새 중 큰 쪽, MultiEdit = 합, Write = 새 내용) */
function changedLines(tool, ti) {
  if (tool === 'Edit') return Math.max(lineCount(ti.old_string), lineCount(ti.new_string));
  if (tool === 'MultiEdit') return (ti.edits || []).reduce((n, e) => n + Math.max(lineCount(e.old_string), lineCount(e.new_string)), 0);
  if (tool === 'Write') return lineCount(ti.content);
  return Infinity;
}

/** 이번 요청과 바로 앞 요청의 답변 글에 머리말이 있나 (대화 기록 JSONL) */
function headerShown(transcript) {
  let rows;
  try { rows = fs.readFileSync(transcript, 'utf8').split('\n'); } catch { return true; } // 기록을 못 읽으면 통과
  let prompts = 0;
  for (let i = rows.length - 1; i >= 0 && prompts < 2; i -= 1) {
    let d;
    try { d = JSON.parse(rows[i]); } catch { continue; }
    const c = (d.message || {}).content;
    if (d.type === 'user') {
      const real = !d.isMeta && !d.isCompactSummary && (typeof c === 'string' || (Array.isArray(c) && c.some((x) => x.type === 'text') && !c.some((x) => x.type === 'tool_result')));
      if (real) prompts += 1;
    } else if (d.type === 'assistant' && Array.isArray(c) && c.some((x) => x.type === 'text' && HEADER.test(x.text || ''))) return true;
  }
  return false;
}

run(() => {
  const input = readInput();
  const id = safeId(input.session_id);
  if (!id) return;
  const ROOT = root();
  const mark = path.join(stateDir(ROOT), `${id}.planfirst`);
  const ev = String(input.hook_event_name || '');
  if (ev === 'UserPromptSubmit') { try { fs.unlinkSync(mark); } catch { /* 없음 */ } return; }
  if (ev !== 'PreToolUse') return;
  let level = 'warn';
  try { const kit = require(path.join(ROOT, 'bin', 'kit.js')); level = (kit.resolveModels(ROOT, kit.loadWorkspace(ROOT)).enforce || {}).planFirst || level; } catch { /* 옛 워크스페이스 */ }
  if (level === 'off' || (level === 'warn' && fs.existsSync(mark))) return;
  const tool = String(input.tool_name || '');
  const ti = input.tool_input || {};
  const file = ti.file_path || ti.notebook_path;
  if (!file) return;
  const abs = real(path.resolve(input.cwd || ROOT, file));
  let ws;
  try { ws = load(ROOT); } catch { return; }
  const inCode = ws.repos.some((r) => r.kind === 'code' && [r.dir, real(r.dir)].some((d) => abs === d || abs.startsWith(d + path.sep)));
  if (!inCode) return;
  if (LIGHT.test(abs) && changedLines(tool, ti) <= 2) return;
  if (headerShown(input.transcript_path)) return;
  const what = '이번 요청에서 「착수 전 확인:」 없이 코드를 고치려 합니다. 기능 변경 · 공유 상태 변경이면 먼저 `착수 전 확인:` 머리말로 영향 범위 · 공유 상태 · 구조 결정 · 검증 · 시간 예산을 보이고 사용자 확인을 받습니다 (go 스킬 3단계). '
    + '오타 · 한두 줄 같은 단순 수정이면 `착수 전 확인: 단순 수정 (이유)` 한 줄을 적고 이어 갑니다. 수준 바꾸기: aidure team-mode enforce plan off|warn|block';
  if (level === 'block') { deny(what); return; }
  fs.writeFileSync(mark, '1');
  note(what);
});
