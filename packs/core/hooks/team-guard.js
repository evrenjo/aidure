#!/usr/bin/env node
// PreToolUse(Bash) 훅 (Claude Code) — 팀원(agent teams) 창 · 프로세스를 강제로 닫는 명령을 막는다. 막을 때만 deny JSON, 아니면 출력 없음. 항상 exit 0
/*
 * 팀원은 정식 종료 요청을 받고 스스로 승인해야 팀 등록에서 빠진다. 창(tmux kill-pane 등)이나 프로세스를 먼저 죽이면
 * 등록만 남아 화면에 대기(○) 팀원이 쌓이고, 나중에 종료 요청을 다시 보내면 기록에서 되살아난다.
 */
'use strict';
const { run, readInput, deny } = require('../lib/hook');

const KILL = /\btmux\b[^|;&]*\b(kill-pane|kill-window|kill-session|kill-server)\b|\bpkill\b[^|;&]*claude|\bkillall\b[^|;&]*claude/;

run(() => {
  const input = readInput();
  if (String(input.tool_name || '') !== 'Bash') return;
  const cmd = String((input.tool_input || {}).command || '');
  if (!KILL.test(cmd)) return;
  deny('팀원 창 · 프로세스를 강제로 닫지 않는다 (등록만 남아 대기 팀원이 쌓인다). ' +
    '팀원마다 정식 종료 요청을 보내고 그 팀원의 승인(종료) 알림을 기다린다. 일반 메시지("종료해 주세요")로는 끝나지 않는다. ' +
    '몇 분 지나도 팀원 목록에 남아 있으면 창 · 프로세스를 닫지 말고 TaskStop(task_id 에 팀원 이름)으로 멈춘다 (등록까지 빠진다). 그래도 남으면 사용자에게 남은 팀원 이름을 알린다. 절차는 team 스킬 「정리」.');
});
