#!/usr/bin/env node
// 설정 안내 (Claude Code · Codex UserPromptSubmit): 사용자가 불만 · 바람을 말하고("왜 이래" · "이런 거 안 되나" · "매번 …") 주제어가 킷 설정과 맞으면,
// (흔한 말 "왜 · 너무 · 할 수 있나" 는 에이전트 · 킷 · 설정을 가리킬 때만) 관련 설정 후보(무엇 · 범위 · 명령)를 에이전트에게 한 줄씩 넣는다. 에이전트는 맞을 때만 안내하고 바꿀지 묻는다 (규칙 core 10-communication).
// 지도: packs/core/settings-map.json. 같은 세션에서 같은 안내는 다시 넣지 않는다 (상태: stateDir 의 <세션>.hints). 출력: 평문 (두 도구 모두 문맥에 더함)
'use strict';
const fs = require('fs');
const path = require('path');
const { run, readInput, context, safeId, root } = require('../lib/hook');
const { stateDir, load } = require('../lib/workspace');

const MAX = 2;

/** 프롬프트 → 맞는 안내 항목 (불만 표현이 없으면 빈 목록) */
function hints(prompt, map) {
  const text = String(prompt || '');
  if (!text) return [];
  const strong = new RegExp(map.complaint, 'im').test(text);
  const weak = !!map.weak && new RegExp(map.weak, 'im').test(text);
  const about = !!map.about && new RegExp(map.about, 'i').test(text);
  // 흔한 말(왜 · 너무 · 할 수 있나)은 에이전트 · 킷을 가리키거나, 주제어가 킷 기능 자체인 항목(weakOk)일 때만
  return (map.entries || []).filter((e) => (strong || (weak && (about || e.weakOk))) && new RegExp(e.topic, 'i').test(text));
}

if (require.main === module) {
  run(() => {
    const input = readInput();
    const R = root();
    const map = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'settings-map.json'), 'utf8'));
    const found = hints(input.prompt || input.user_prompt || '', map);
    if (!found.length) return;
    const id = safeId(input.session_id);
    const file = id ? path.join(stateDir(R), `${id}.hints`) : null;
    let seen = [];
    try { seen = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* 처음 */ }
    const fresh = found.filter((e) => !seen.includes(e.id)).slice(0, MAX);
    if (!fresh.length) return;
    if (file) try { fs.writeFileSync(file, JSON.stringify([...seen, ...fresh.map((e) => e.id)])); } catch { /* 상태는 편의 */ }
    let lead = '';
    try {
      const T = require('../lib/team');
      const ws = load(R);
      const w = T.whoAmI(R, ws);
      const leads = T.roster(ws).leads.map(T.callName).filter(Boolean);
      if (!w.lead && leads.length) lead = ` 팀 범위 설정은 팀장(${leads.join(' · ')})님이 바꾼다.`;
    } catch { /* 팀 없음 */ }
    context(`설정 안내 후보 (사용자 말이 이 설정으로 풀리는 불만일 때만 안내하고 바꿀지 묻는다. 아니면 무시):${fresh.map((e) => ` ${e.say} → \`${e.cmd}\` (${e.scope})`).join(' ·')}.${lead}`);
  });
}
module.exports = { hints };
