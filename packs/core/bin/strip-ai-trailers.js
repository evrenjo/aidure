#!/usr/bin/env node
// 커밋 메시지에서 AI 도구 서명 줄을 지운다 — git commit-msg 훅이 부른다. 실행: node packs/core/bin/strip-ai-trailers.js <메시지 파일>
/*
 * 지우는 줄: 도구 주소(noreply@anthropic.com · noreply@openai.com)의 Co-authored-by, "Generated with Claude Code / Codex".
 * Claude Code 는 .claude/settings.json attribution 으로 끄지만, Codex 는 계정 설정이 켜져 있으면 지시문으로 넣게 해
 * 규칙으로는 못 막는다 — 그래서 커밋 단계에서 지운다. 사람이 적은 다른 Co-authored-by 는 그대로 둔다.
 * 어떤 경우에도 커밋을 막지 않는다 (exit 0).
 */
'use strict';

const fs = require('fs');

const AI_LINE = [
  /^\s*co-authored-by:.*<noreply@(anthropic|openai)\.com>/i,
  /^\s*(🤖\s*)?generated with \[?(claude code|codex)\]?/i,
];

function strip(text) {
  const lines = text.split('\n').filter((l) => !AI_LINE.some((re) => re.test(l)));
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  return lines.length ? `${lines.join('\n')}\n` : '';
}

if (require.main === module) {
  try {
    const file = process.argv[2];
    const before = fs.readFileSync(file, 'utf8');
    const after = strip(before);
    if (after !== before && after.trim()) fs.writeFileSync(file, after);
  } catch { /* 커밋을 막지 않는다 */ }
  process.exit(0);
}

module.exports = { strip };
