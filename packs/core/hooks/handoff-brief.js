#!/usr/bin/env node
// SessionStart 훅 — 본인 마지막 핸드오프를 1줄로 알린다 (다음 세션이 이전 작업을 이어가게). 기록이 없으면 출력하지 않는다. 항상 exit 0
/*
 * 읽는 것: handoffs/{id}/LATEST.md 의 날짜 · 「진행 중」 첫 줄, 미완 작업 수(topics/ 진행 중 + 완료 조건 [ ]), 사용자가 등록한 TODO.md 항목 수. 이 PC 작업 폴더만 본다 (fetch 하지 않는다 — 빠르게).
 * 전부 불러오지는 않는다(토큰). 이어가는 요청이면 에이전트가 resume 스킬로 자세히 읽는다.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { run, context } = require('../lib/hook');
const { root, devId, localDate } = require('../lib/workspace');
const { listTopics, isOpen } = require('../lib/topics');

run(() => {
  const ROOT = root();
  const id = devId(ROOT);
  if (!id) return;
  const dir = path.join(ROOT, 'handoffs', id);
  const read = (f) => { try { return fs.readFileSync(path.join(dir, f), 'utf8'); } catch { return ''; } };
  const latest = read('LATEST.md');
  const todo = read('TODO.md');
  if (!latest && !todo) return;
  const date = (latest.match(/^#.*?\((\d{4}-\d{2}-\d{2})\)/m) || [])[1];
  // 「진행 중」 섹션 첫 항목
  const sec = latest.split(/^##\s+/m).find((s) => s.startsWith('진행 중')) || '';
  const doing = (sec.split('\n').slice(1).map((l) => l.replace(/^\s*[-*]\s+/, '').trim()).find((l) => l && l !== '없음') || '').slice(0, 80);
  const left = todo.split('\n').filter((l) => /^\s*[-*]\s+/.test(l)).length;
  const open = listTopics(ROOT, id).filter(isOpen).length;
  const days = date ? Math.floor((new Date(localDate()) - new Date(date)) / 86400000) : null;
  const when = date ? `${date}${days === 0 ? ' (오늘)' : days > 0 ? ` (${days}일 전)` : ''}` : '날짜 없음';
  // 기록이 커졌으면 알린다 (handoff.js check 와 같은 기준 중 빠른 것만)
  const big = [];
  if (Buffer.byteLength(latest) > 4096) big.push(`LATEST ${(Buffer.byteLength(latest) / 1024).toFixed(1)}KB`);
  try { for (const f of fs.readdirSync(dir)) if (/^\d{4}-W\d{2}\.md$/.test(f) && fs.statSync(path.join(dir, f)).size > 60 * 1024) big.push(f); } catch { /* 없음 */ }
  const tail = big.length ? ` · ⚠ 기록이 큼(${big.slice(0, 3).join(', ')}${big.length > 3 ? ' …' : ''}): handoff-organize 로 정리` : '';
  context(`📌 ${id} 마지막 핸드오프 ${when}${doing ? ` · 진행 중: ${doing}` : ''} · 미완 작업 ${open}건 · 내 TODO ${left}건. 이전 작업을 잇는 요청이면 먼저 resume 스킬(handoffs/${id}/LATEST.md · topics/)로 이어서 한다${tail}`);
});
