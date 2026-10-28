// refs.js 점검 — 참고 자료 repo 의 받음 · 폴더 · 내용 유무 판정. 실행: node refs.test.js
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { referenceStatus, describe } = require('./refs');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kedovi-refs-'));
const mk = (rel, body = 'x') => { const f = path.join(tmp, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body); };
mk('repos/plans/README.md', '# 템플릿');            // 기획: md/ 폴더 없음
mk('repos/plans2/README.md'); mk('repos/plans2/md/.gitkeep'); // 기획: md/ 는 있는데 비어 있음
mk('repos/plans3/md/a.md'); mk('repos/plans3/md/sub/b.md'); mk('repos/plans3/md/README.md'); // 기획: md 2개 (README 제외)
mk('repos/legacy/src/PGM01.cbl'); mk('repos/legacy/.git/HEAD'); // 레거시: 소스 1개 (.git 제외)
mk('repos/issue/README.md'); // 이슈: README 만
const ws = { root: tmp, repos: [
  { name: 'plans', kind: 'docs', dir: 'repos/plans', mdPath: 'md' },
  { name: 'plans2', kind: 'docs', dir: 'repos/plans2', mdPath: 'md' },
  { name: 'plans3', kind: 'docs', dir: 'repos/plans3', mdPath: 'md' },
  { name: 'legacy', kind: 'legacy', dir: 'repos/legacy' },
  { name: 'issue', kind: 'issues', dir: 'repos/issue' },
  { name: 'gone', kind: 'docs', dir: 'repos/gone', mdPath: 'md' },
  { name: 'api', kind: 'code', dir: 'repos/api' },
] };
const cases = [];
const it = (name, fn) => cases.push([name, fn]);
it('상태 판정: 폴더 없음 · 비어 있음 · ok · 받지 않음, 코드 repo 는 제외', () => {
  const st = Object.fromEntries(referenceStatus(ws).map((s) => [s.name, s]));
  assert.strictEqual(st.plans.state, 'no-path');
  assert.strictEqual(st.plans2.state, 'empty');
  assert.strictEqual(st.plans3.state, 'ok'); assert.strictEqual(st.plans3.count, 2);
  assert.strictEqual(st.legacy.state, 'ok'); assert.strictEqual(st.legacy.count, 1);
  assert.strictEqual(st.issue.state, 'empty');
  assert.strictEqual(st.gone.state, 'missing');
  assert.strictEqual(st.api, undefined);
});
it('설명 문구', () => {
  const st = Object.fromEntries(referenceStatus(ws).map((s) => [s.name, s]));
  assert.match(describe(st.plans), /md\/ 폴더 없음/);
  assert.match(describe(st.plans2), /비어 있음/);
  assert.match(describe(st.plans3), /md 2개/);
  assert.match(describe(st.legacy), /파일 1개/);
  assert.match(describe(st.gone), /받지 않음/);
});
let failed = 0;
for (const [name, fn] of cases) { try { fn(); console.log(`✔ ${name}`); } catch (e) { failed++; console.log(`✖ ${name}\n  ${e.message}`); } }
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
