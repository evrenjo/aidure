#!/usr/bin/env node
// PostToolUse 훅 (Claude Code) — 알림 수준이 전체 · 진행 현황이면, 사용자 입력 없이 오래 작업 중일 때 몇 분마다 진행 현황을 보낸다. 출력 없음. 항상 exit 0
/*
 * 도구마다 불리므로 가볍게: 채널 세션이 아니고 이 PC 수준이 전체 · 진행 현황이 아니면 바로 끝난다.
 * 기준: 마지막 사용자 요청(notify.js 가 적는 <session>.turn) 뒤 N 분이 지났고, 마지막 현황 뒤 N 분이 지났을 때. N = .agents/local.json notify.channelProgress (분, 기본 5, 0 = 끔)
 * 내용: 경과 시간 · 도구 호출 수 · 최근 작업 몇 개 (도구 이름과 설명 · 명령 · 파일)
 */
'use strict';
const fs = require('fs');
const path = require('path');
if (process.env.AIKIT_CHANNEL !== '1') {
  let level = null;
  try { level = (JSON.parse(fs.readFileSync(path.join(process.env.CLAUDE_PROJECT_DIR || process.cwd(), '.agents', 'local.json'), 'utf8')).notify || {}).level; } catch { /* 없음 */ }
  if (!['all', 'progress'].includes(level)) process.exit(0);
}
const { run, readInput, safeId, root } = require('../lib/hook');
const { stateDir, load } = require('../lib/workspace');
const notify = require('../lib/notify');

/** 도구 호출 한 줄 요약 */
function describe(input) {
  const t = String(input.tool_name || '');
  const i = input.tool_input || {};
  const short = (s, n = 70) => { const x = String(s || '').replace(/\s+/g, ' ').trim(); return x.length > n ? `${x.slice(0, n - 1)}…` : x; };
  if (t === 'Bash') return `명령: ${short(i.description || i.command)}`;
  if (/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(t)) return `수정: ${path.basename(String(i.file_path || i.notebook_path || ''))}`;
  if (t === 'Read') return `읽기: ${path.basename(String(i.file_path || ''))}`;
  if (/^(Grep|Glob)$/.test(t)) return `찾기: ${short(i.pattern, 40)}`;
  if (/^(Agent|Task)$/.test(t)) return `에이전트: ${short(i.name || i.description, 50)}`;
  if (t === 'SendMessage') return `팀원에게 메시지: ${short(i.to || i.recipient, 30)}`;
  if (/telegram/i.test(t)) return null; // 텔레그램 답은 이미 그쪽에 있다
  return t ? `${t.replace(/^mcp__/, '')}` : null;
}

run(async () => {
  const input = readInput();
  const ROOT = root();
  const id = safeId(input.session_id);
  if (!id) return;
  let ws0 = {};
  try { ws0 = load(ROOT); } catch { /* 없음 */ }
  const cfg0 = notify.personal(ROOT, ws0);
  if (!notify.wantsProgress(cfg0)) return; // 전체 수준이거나 진행 현황 수준 + 자리 비움일 때만
  if (cfg0.remote !== 'send' && notify.remoteControl(input.session_id)) return; // 리모트 컨트롤이면 앱이 보여 준다
  const local = notify.readLocal(ROOT).notify || {};
  const every = Number(local.channelProgress != null ? local.channelProgress : 5);
  if (!(every > 0)) return;
  const dir = stateDir(ROOT);
  const logFile = path.join(dir, `${id}.progress.json`);
  let st = {};
  try { st = JSON.parse(fs.readFileSync(logFile, 'utf8')); } catch { /* 처음 */ }
  let turn = 0;
  try { turn = Number(fs.readFileSync(path.join(dir, `${id}.turn`), 'utf8')) || 0; } catch { /* 요청 시각 모름 */ }
  if (st.turn !== turn) st = { turn, count: 0, recent: [], sentAt: 0 }; // 새 요청: 다시 센다
  st.count += 1;
  const line = describe(input);
  if (line && st.recent[st.recent.length - 1] !== line) st.recent = [...st.recent, line].slice(-5);
  const now = Date.now();
  const due = turn && now - turn >= every * 60000 && now - (st.sentAt || 0) >= every * 60000;
  if (due) {
    st.sentAt = now;
    let ws = {};
    try { ws = load(ROOT); } catch { /* 없음 */ }
    const cfg = notify.personal(ROOT, ws);
    if (cfg.token && cfg.chat) {
      const mins = Math.round((now - turn) / 60000);
      await notify.send(`⏳ [${notify.projectName(ROOT, ws)}] 작업 중 ${mins}분 · 도구 ${st.count}회\n최근:\n${st.recent.map((r) => `- ${r}`).join('\n')}`, cfg).catch(() => {});
    }
  }
  fs.writeFileSync(logFile, JSON.stringify(st));
});
