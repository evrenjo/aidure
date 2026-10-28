#!/usr/bin/env node
// SessionStart 훅 (Claude Code · Codex) — 팀과 다른 개인 모델 설정(이 PC 프로필 · 직접 지정 · 상한)이 적용 중이면 1줄로 알린다. 모두 팀 값이면 아무것도 쓰지 않는다. 항상 exit 0
// 판정은 bin/kit.js profileNotice (이 PC 프로필은 팀보다 낮은 것만 적용, 상한은 팀 값 이내). 되돌리기: kedovi models profile team
'use strict';
const path = require('path');
const { run, context, root } = require('../lib/hook');

run(() => {
  const ROOT = root();
  const kit = require(path.join(ROOT, 'bin', 'kit.js'));
  if (!kit.profileNotice) return;
  const notice = kit.profileNotice(ROOT, kit.loadWorkspace(ROOT));
  if (notice) context(`🎚 ${notice}`);
});
