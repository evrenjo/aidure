// mermaid-check.js 점검: 블록 찾기(줄 번호 · ~~~ · 다른 언어 제외) · 문법 오류만 잡기 · 브라우저 전용 오류는 넘기기. 실행: node mermaid-check.test.js
'use strict';
const assert = require('assert');
const MC = require('./mermaid-check');

const md = ['# 문서', '', '```mermaid', 'flowchart LR', '  A[웹<br/>서버] --> B[(DB)]', '```', '', '~~~mermaid', 'sequenceDiagram', '  A->>B: 요청', '~~~', '',
  '```mermaid', 'flowchart TD', '  A[x --> B', '```', '', '```js', 'flowchart TD', '```', ''].join('\n');
const list = MC.blocks({ 'a.md': md, 'b.html': '```mermaid\nx\n```' });
assert.deepStrictEqual(list.map((b) => [b.file, b.line]), [['a.md', 3], ['a.md', 8], ['a.md', 13]], 'md 의 mermaid 블록만, 여는 줄 번호');
assert.strictEqual(list[1].src, 'sequenceDiagram\n  A->>B: 요청');

const art = MC.asciiArt({ 'a.md': ['```', '[웹] ──▶ [API]', '  │', '  ▼', '[DB]', '```', '', '```js', 'a --> b', 'c --> d', 'e --> f', '```', '', '```', '한 줄 → 설명', '```'].join('\n') });
assert.deepStrictEqual(art, [{ file: 'a.md', line: 1 }], 'ASCII 그림: 언어 없는 블록에서 그림 줄 3줄 이상만');

MC.check(list).then((bad) => {
  assert.deepStrictEqual(bad.map((b) => b.line), [13], '문법 오류만 (HTML 라벨 <br/> 은 오류 아님)');
  assert.match(bad[0].error, /Parse error/);
  return MC.check([{ file: 'c.md', line: 1, src: 'erDiagram\n  USERS ||--o{ ORDERS : places' }]);
}).then((bad) => {
  assert.deepStrictEqual(bad, [], 'erDiagram');
  console.log('mermaid-check.test.js ✔');
}).catch((e) => { console.error(e); process.exit(1); });
