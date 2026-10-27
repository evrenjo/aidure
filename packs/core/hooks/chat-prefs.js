#!/usr/bin/env node
// UserPromptSubmit 훅 (Claude Code): 요청마다 응답 언어 · 대화 스타일 한 줄을 넣는다.
/*
 * 긴 작업 중 진행 알림이 다른 언어로 새는 것을 막는다. 규칙 정본은 개인 지침 머리(lib/chatprefs.js headSection)이고 이 줄은 다시 알리기만.
 * 값: 이 PC .agents/local.json chat → 팀 workspace.json chat → 기본(팀 문서 언어 · 일반). aidure prefs
 * Codex 는 UserPromptSubmit 의 평문 출력 계약이 확인되지 않아 Claude 에만 건다 (Codex 는 AGENTS.override.md 머리).
 */
'use strict';
const { run, context, root } = require('../lib/hook');
const prefs = require('../lib/chatprefs');

run(() => {
  context(prefs.reminder(prefs.resolve(root())));
});
