#!/usr/bin/env node
// 멈추기 전 정리 — 끝나지 않은 위임 작업(delegate.js)이 있으면 결과를 받거나 정리하라고 한 번 알린다 (Stop).
// 대기로 오래 남은 팀원(agent teams)은 team-idle.js 가 본다.
// 기다리며 멈추는 것은 된다: 답변에 상태 줄(「지금 도는 것:」)이 있으면 막지 않는다. 결과는 백그라운드 wait 의 완료 알림이나 다음 요청에서 받는다.
'use strict';
const fs = require('fs');
const path = require('path');
const { readInput, block, run, root } = require('../lib/hook');
const { stateDir } = require('../lib/workspace');
const { hasStatus } = require('../lib/teamidle');

run(() => {
  const input = readInput();
  if (input.stop_hook_active) return; // 한 번만 — 다시 멈추면 그대로 둔다
  const jobs = path.join(stateDir(root()), 'delegate');
  let ids = [];
  try { ids = fs.readdirSync(jobs); } catch { return; }
  const day = Date.now() - 86400000;
  const running = ids.filter((id) => {
    const dir = path.join(jobs, id);
    if (fs.existsSync(path.join(dir, 'result.json'))) return false;
    try { return JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8')).startedAt > day; } catch { return false; }
  });
  if (!running.length || hasStatus(input.last_assistant_message)) return;
  block(`끝나지 않은 위임 작업이 ${running.length}개 있습니다 (${running.join(', ')}). 결과를 기다리며 다른 일을 하거나 멈추려면 node packs/core/bin/delegate.js wait <id> 를 백그라운드로 돌리고(끝나면 알림이 온다) 답변 끝에 상태 줄을 적습니다: "지금 도는 것: 위임 <역할> · 예상 종료: <언제쯤> · 사용자가 할 일: <있음(무엇) | 없음>". 필요 없는 작업이면 사용자에게 알리고 멈춥니다.`);
});
