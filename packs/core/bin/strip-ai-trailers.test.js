// strip-ai-trailers.js 점검. 실행: node strip-ai-trailers.test.js
'use strict';
const assert = require('assert');
const { strip } = require('./strip-ai-trailers');

const cases = [];
const it = (name, fn) => cases.push([name, fn]);

it('Claude 서명을 지운다', () => {
  assert.strictEqual(strip('feat: 로그인\n\n본문\n\nCo-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>\n'), 'feat: 로그인\n\n본문\n');
});
it('Codex 서명을 지운다', () => {
  assert.strictEqual(strip('fix: 합계\n\nCo-authored-by: Codex <noreply@openai.com>\n'), 'fix: 합계\n');
});
it('Generated with 줄을 지운다', () => {
  assert.strictEqual(strip('docs: a\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n'), 'docs: a\n');
  assert.strictEqual(strip('docs: a\n\nGenerated with [Codex](https://openai.com/codex/).\n'), 'docs: a\n');
});
it('사람이 적은 공동 작성자와 git 주석은 남긴다', () => {
  const msg = 'feat: x\n\nCo-authored-by: Kim <kim@example.com>\nCo-authored-by: Claude Park <claude.park@example.com>\n# Please enter the commit message\n';
  assert.strictEqual(strip(msg), msg);
});
it('서명이 없으면 그대로', () => {
  assert.strictEqual(strip('chore: y\n'), 'chore: y\n');
});

let failed = 0;
for (const [name, fn] of cases) {
  try { fn(); console.log(`✔ ${name}`); } catch (e) { failed++; console.log(`✖ ${name}\n  ${e.message}`); }
}
process.exit(failed ? 1 : 0);
