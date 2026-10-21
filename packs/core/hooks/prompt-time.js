#!/usr/bin/env node
// UserPromptSubmit 훅 (Claude Code) — 요청을 받은 시각을 넣고, 이번 요청의 첫 답변 첫 줄에 그 시각을 쓰게 한다.
/*
 * 모델은 현재 시각을 모른다. 훅이 시각을 주고 지시도 같이 넣어 always 룰 예산을 쓰지 않는다 (끄면 아무것도 넣지 않는다).
 * 켜기 · 끄기: 이 PC .agents/local.json chat.timestamp → 팀 workspace.json chat.timestamp → 기본 켜짐. aidure timestamp on|off [--team]
 * 시각은 요청을 받은 때(작업 시작)다. 끝 시각이 아니다. 팀원 · 서브에이전트에서는 돌지 않는다 (hook.js run).
 * Codex 는 UserPromptSubmit 의 평문 출력 계약이 확인되지 않아 Claude 에만 건다 (hooks.json agents: claude).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { run, context, root } = require('../lib/hook');

/** 켜져 있나: 이 PC 값 → 팀 값 → 기본 켜짐 */
function enabled(r) {
  const pick = (f) => { try { const v = (JSON.parse(fs.readFileSync(f, 'utf8')).chat || {}).timestamp; return typeof v === 'boolean' ? v : undefined; } catch { return undefined; } };
  const mine = pick(path.join(r, '.agents', 'local.json'));
  if (mine !== undefined) return mine;
  const team = pick(path.join(r, 'workspace.json'));
  return team !== undefined ? team : true;
}

/** yyyy-MM-dd HH:mm:ss (이 PC 시간대) */
function stamp(d = new Date()) {
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`;
}

if (require.main === module) {
  run(() => {
    if (!enabled(root())) return;
    context(`⏱ 요청 받은 시각 ${stamp()}. 이번 요청의 첫 답변 글 첫 줄에 이 시각만 그대로 쓴다 (yyyy-MM-dd HH:mm:ss, 다른 말 없이). 같은 요청의 다음 글에는 다시 쓰지 않는다`);
  });
}

module.exports = { enabled, stamp };
