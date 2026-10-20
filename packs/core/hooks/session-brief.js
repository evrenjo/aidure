#!/usr/bin/env node
// SessionStart 훅 (Claude Code · Codex) — 세션 브리핑(bin/brief.js: 프로젝트 · 참고 자료 · 공지 · 마지막 핸드오프 · 미완 작업 · TODO)을 컨텍스트로 넘긴다. 항상 exit 0
// 브리핑 본문을 첫 사용자 메시지로 넣으면 화면에 전문이 찍히므로, 본문은 여기서 넘기고 aikit start 는 "세션 브리핑" 한 줄만 보낸다.
// 여러 줄 출력은 이 훅만의 예외다 (다른 SessionStart 훅은 1줄). .agents/local.json 의 brief:false 면 아무것도 넘기지 않는다.
'use strict';
const fs = require('fs');
const path = require('path');
const { run, context, root } = require('../lib/hook');

run(() => {
  const ROOT = root();
  let conf = {};
  try { conf = JSON.parse(fs.readFileSync(path.join(ROOT, '.agents', 'local.json'), 'utf8')); } catch { /* 없음 */ }
  if (conf.brief === false) return;
  const { briefText } = require('../bin/brief.js');
  const text = (briefText() || '').trim();
  if (!text) return;
  context(`📋 세션 브리핑. 사용자의 첫 요청이 "세션 브리핑" 이면 아래 내용을 설명을 보태지 말고 짧은 표나 목록으로 그대로 보여 준 뒤(로드맵 흐름도 코드 블록과 단계 표는 바꾸지 말고 그대로) "무엇부터 할까요?" 한 줄만 묻는다. 다른 요청이면 참고만 한다. 이전 작업을 잇자고 하면 resume 스킬을 따른다.\n${text}`);
});
