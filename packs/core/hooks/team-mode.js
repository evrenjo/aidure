#!/usr/bin/env node
// SessionStart 훅 (Claude Code) — 역할 에이전트를 팀 모드(agent teams 의 팀원 세션)로 띄울지 서브에이전트로 띄울지 환경으로 판정해 1줄로 알린다. 항상 exit 0
/*
 * 세션 시작뿐 아니라 이어서 시작 · 대화 요약(compact) · 비우기 뒤에도 돈다 (요약되면 이 줄이 사라져 이름 없이 띄우게 된다).
 * 판정은 lib/teammode.js. 판정만 하고 설정은 바꾸지 않는다. team 스킬이 이 줄을 보고 실행 방식을 정하고 사용자에게 알린다. 상한·역할 모델은 두 방식 같다.
 * 팀 모드에서 역할 에이전트를 이름 없이 띄우는 것은 hooks/agent-budget.js 가 막는다 (aidure team-mode enforce name).
 */
'use strict';
const { run, context, root } = require('../lib/hook');
const { judge, nameCheck } = require('../lib/teammode');

run(() => {
  const ROOT = root();
  const { team, verdict } = judge(ROOT);
  const check = team ? nameCheck(ROOT) : 'off';
  const how = team
    ? `역할마다 Agent 도구에 name(역할 이름)을 주어 팀원으로 띄우고 SendMessage·TaskList 로 결과를 받는다${check === 'block' ? ' (이름 없이 띄우면 훅이 막는다)' : ''}. 팀원을 띄울 때 사용자에게 「팀원 창에 승인 질문이 뜨면 그 창에서 승인해야 시작합니다」 를 함께 알린다 (리더 화면에는 안 보인다)`
    : 'Agent 도구(서브에이전트)로 띄운다';
  context(`🧩 역할 에이전트 실행 방식: ${verdict}. ${how}. 작업을 시작할 때 이 방식을 사용자에게 한 줄로 알린다 (team 스킬). 상한·역할 모델은 두 방식 같다`);
});
