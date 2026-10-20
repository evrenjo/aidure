#!/usr/bin/env node
// Stop 훅 — 이번 세션에 손댄 작업 기록(topics/<작업>.md)의 "## 완료 조건" 에 미완 항목([ ])이 있으면, 끝내기 전에 처리하거나 보고하게 한다.
/*
 * 출력 계약: 막을 때만 {"decision":"block","reason":…} JSON, 아니면 아무것도 출력하지 않는다. 항상 exit 0.
 * - 대상 = 상태: 진행 중 이고, 이 세션 시작 이후 수정된 기록 (이번 세션에 손대지 않은 작업은 보지 않는다. 브리핑만 하고 끝내는 턴 등)
 * - [~] (사용자 결정 대기) 는 미완으로 세지 않는다
 * - 세션마다 작업 하나당 한 번만 막는다 (상태 폴더의 <session>.taskcheck.json). stop_hook_active 면 통과 (루프 방지)
 * - "기억" 이 아니라 파일 상태로 판단하므로 세션·PC 가 바뀌어도 같다
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { run, readInput, block, sessionStartedAt, safeId } = require('../lib/hook');
const { load, devId, stateDir } = require('../lib/workspace');
const { activeTopics } = require('../lib/topics');

run(() => {
  const input = readInput();
  if (input.stop_hook_active) return;
  const ws = load();
  const id = devId(ws.root);
  if (!id) return;
  const since = sessionStartedAt(input);
  if (!since) return; // 세션 시작 기록이 없으면 이번 세션에 손댄 작업을 가릴 수 없다
  const open = activeTopics(ws.root, id, since).filter((t) => t.todo.length);
  if (!open.length) return;
  const file = path.join(stateDir(ws.root), `${safeId(input.session_id) || 'nosession'}.taskcheck.json`);
  let seen = [];
  try { seen = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* 처음 */ }
  const fresh = open.filter((t) => !seen.includes(t.name));
  if (!fresh.length) return;
  fs.writeFileSync(file, JSON.stringify([...seen, ...fresh.map((t) => t.name)]));
  const lines = fresh.map((t) => `- ${t.name}: ${t.todo.slice(0, 6).join(' / ')}${t.todo.length > 6 ? ` … (${t.todo.length}개)` : ''}`);
  block(
    `끝내기 전에 작업 기록(handoffs/${id}/topics/)의 완료 조건을 확인하세요. 미완 항목:\n${lines.join('\n')}\n` +
    '지금 끝낼 수 있는 항목은 끝내고 [x] 로 바꾸세요. 사용자 결정을 기다리는 항목은 [~] 로 바꾸면 다음부터 점검하지 않습니다. 끝낼 수 없는 항목은 [ ] 그대로 두고(그 기록이 남은 일의 정본이다. TODO.md 로 옮기지 않는다) 이유를 사용자에게 한 줄로 보고한 뒤 멈추세요. ' +
    '완료 조건 자체가 바뀌었으면 기록을 고치세요. 새 작업은 시작하지 않습니다.'
  );
});
