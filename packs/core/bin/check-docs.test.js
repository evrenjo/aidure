'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { checkDocs, cellCount } = require('./check-docs');

assert.strictEqual(cellCount('| a | b |'), 2);
assert.strictEqual(cellCount('| a \\| b | c |'), 2);
assert.strictEqual(cellCount('a | b'), 2);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-docs-'));
const write = (name, text) => { fs.writeFileSync(path.join(dir, name), text); return path.join(dir, name); };

// 정상 문서
const ok = write('ok.md', [
  '# 기능', '', '| ID | 이름 |', '|---|---|', '| F-001 | 주문 |', '| F-002 | 결제 \\| 환불 |', '',
  '## F-003 배송', '', 'F-001 과 F-002 를 쓴다.', '', '```', '| 코드 | 안 |', '|---|', '```', '',
].join('\n'));
let r = checkDocs([ok]);
assert.deepStrictEqual(r.issues, [], JSON.stringify(r.issues));

// 구분선 열 수 · 셀 안 | · 중복 정의 · 없는 ID 참조 · 번호 건너뜀
const bad = write('bad.md', [
  '| ID | 이름 | 비고 |', '|---|---|', '| F-001 | 주문 | 없음 |', '| F-002 | 결제 | 카드 | 현금 |', '| F-005 | 환불 | - |', '',
  '- F-001 다시 정의', '', 'F-010 을 본다.', '',
].join('\n'));
r = checkDocs([bad]);
const msgs = r.issues.map((x) => `${x.level}:${x.line}:${x.msg}`);
assert.ok(msgs.some((m) => /^error:2:표 구분선 2칸 · 머리 줄 3칸/.test(m)), msgs.join('\n'));
assert.ok(msgs.some((m) => /^error:4:표 4칸/.test(m)), msgs.join('\n'));
assert.ok(msgs.some((m) => /F-001 가 두 번 정의됨/.test(m)), msgs.join('\n'));
assert.ok(msgs.some((m) => /F-010 를 참조하지만 정의가 없음/.test(m)), msgs.join('\n'));
assert.ok(msgs.some((m) => /^warn:.*F-003, F-004/.test(m)), msgs.join('\n'));

// 다른 문서의 표 첫 칸은 대응표로 보고 중복으로 치지 않는다. 두 문서의 제목이면 중복
const map = write('map.md', '| 기능 | 결정 |\n|---|---|\n| F-001 | 유지 |\n');
assert.ok(!checkDocs([ok, map]).issues.some((x) => /두 번/.test(x.msg)));
const head2 = write('head2.md', '## F-003 배송 다시\n');
assert.ok(checkDocs([ok, head2]).issues.some((x) => /F-003 가 두 번 정의됨/.test(x.msg)));
fs.unlinkSync(map); fs.unlinkSync(head2);

// 정의가 다른 문서에만 있는 머리는 넘기고, --defs 로 원본을 주면 본다
const ref = write('ref.md', 'REQ-ORD-001 과 REQ-ORD-009 를 근거로 한다.\n');
assert.deepStrictEqual(checkDocs([ref]).issues, []);
const src = path.join(dir, 'src');
fs.mkdirSync(src);
fs.writeFileSync(path.join(src, 'req.md'), '| ID | 내용 |\n|---|---|\n| REQ-ORD-001 | 목록 |\n');
r = checkDocs([ref], { defsFrom: [src] });
assert.ok(r.issues.some((x) => /REQ-ORD-009 를 참조하지만 정의가 없음/.test(x.msg)), JSON.stringify(r.issues));
assert.ok(!r.issues.some((x) => /REQ-ORD-001/.test(x.msg)));

// --ids 로 머리를 좁힌다
r = checkDocs([bad], { prefixes: ['REQ'] });
assert.ok(!r.issues.some((x) => /F-0/.test(x.msg)));

// --cover: 원본 결정 ID 전수 · § 참조 · --link · --forbid
const decSrc = write('decisions.md', ['# 결정', '', '| ID | 내용 |', '|---|---|', '| D-001 | 캐시 |', '| D-002 | 정렬 |', '| D-003 | 페이지 |', ''].join('\n'));
const spec = write('spec.md', [
  '# 설계', '', '## 1 개요', '', 'D-001 · D-002 를 따른다. 자세히는 §2.1, 없는 곳은 §9.9.', '', '## 2.1 시나리오', '',
  '| ID | 내용 | 결정 |', '|---|---|---|', '| TC-001 | 목록 | D-001 |', '| TC-002 | 상세 | - |', '', '[TODO-검토] 문구 확인', '',
].join('\n'));
r = checkDocs([spec], { cover: [decSrc], links: [['TC', 'D']], forbid: ['\\[TODO-[^\\]]*\\]'] });
const errs = r.issues.filter((x) => x.level === 'error').map((x) => x.msg);
assert.ok(errs.some((m) => /원본의 D-003 가 검사 문서에 없음/.test(m)), errs.join(' | '));
assert.ok(!errs.some((m) => /D-001 가 검사 문서에 없음|D-002 가 검사 문서에 없음/.test(m)));
assert.ok(errs.some((m) => /§9\.9 이 가리키는 제목이 없음/.test(m)) && !errs.some((m) => /§2\.1/.test(m)), errs.join(' | '));
assert.ok(errs.some((m) => /TC-002 에 D 참조가 없음/.test(m)) && !errs.some((m) => /TC-001 에 D/.test(m)), errs.join(' | '));
assert.ok(errs.some((m) => /남으면 안 되는 표시: \[TODO-검토\]/.test(m)), errs.join(' | '));
r = checkDocs([spec], { cover: [write('d2.md', '| ID | 내용 |\n|---|---|\n| D-001 | 캐시 |\n')] });
assert.ok(r.issues.some((x) => x.level === 'info' && /모두 옮겨짐/.test(x.msg)));
// 번호 제목이 없는 문서는 § 를 보지 않는다
r = checkDocs([write('plain.md', '# 제목\n\n법 §3 참고\n')]);
assert.ok(!r.issues.some((x) => /§/.test(x.msg)));


fs.rmSync(dir, { recursive: true, force: true });
console.log('check-docs.test.js ok');
