#!/usr/bin/env node
// 시간 예산 점검 — 경과가 예산의 1.5배를 넘은 작업(bin/budget.js)을 알린다.
//   UserPromptSubmit (Claude Code): 열린 예산 한 줄 (넘었으면 ⏰) · Stop: 넘은 작업마다 한 번 막고 계속할지 사용자에게 묻게 한다 (막을 때만 block JSON)
'use strict';
const { readInput, block, context, run, root } = require('../lib/hook');
const B = require('../lib/budget');

run(() => {
  const input = readInput();
  const ROOT = root();
  const list = B.load(ROOT);
  if (!list.length) return;
  const ev = String(input.hook_event_name || '');
  if (ev === 'UserPromptSubmit') {
    const late = list.filter((b) => B.over(b));
    return context(late.length
      ? `⏰ 시간 예산 넘음: ${late.map((b) => B.line(b)).join(' | ')}. 이 요청을 진행하기 전에 계속할지 사용자에게 묻는다 (더 하기로 하면 node packs/core/bin/budget.js extend "<작업>" <시간>)`
      : `⏱ 시간 예산: ${list.map((b) => B.line(b)).join(' | ')}`);
  }
  if (ev !== 'Stop' || input.stop_hook_active) return;
  const late = list.filter((b) => B.over(b) && !b.warned);
  if (!late.length) return;
  B.save(ROOT, list.map((b) => (late.includes(b) ? { ...b, warned: true } : b)));
  block(`시간 예산을 ${B.OVER}배 넘었습니다: ${late.map((b) => B.line(b)).join(' | ')}. 사용자에게 선택지로 묻습니다: 계속(예산 늘리기 node packs/core/bin/budget.js extend "<작업>" <시간>) · 범위 줄이기 · 여기서 멈추고 정리. 끝난 작업이면 node packs/core/bin/budget.js done "<작업>".`);
});
