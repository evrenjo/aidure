// topics.js 점검 — 머리 · 완료 조건 · 지킬 것 파싱, 진행 중 작업 고르기. 실행: node topics.test.js
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { parseTopic, listTopics, activeTopics } = require('./topics');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kedovi-topics-'));
const dir = path.join(tmp, 'handoffs', 'kim', 'topics');
fs.mkdirSync(dir, { recursive: true });
const write = (name, body) => fs.writeFileSync(path.join(dir, `${name}.md`), body);
write('주문-목록', `# 주문-목록
관련: REQ-ORD-012
상태: 진행 중
마지막: 2026-09-30
한 줄: 서버 끝, 화면 남음

## 요약
- 페이지네이션은 서버에서

## 완료 조건
- [x] 서버 페이지네이션 테스트 통과
- [ ] 화면 연결
- [ ] 핸드오프 · TODO 갱신

## 지킬 것
- 응답 봉투는 기존 관례대로
- 목록 API 는 page 1 부터

## 2026-09-30
- 한 일
`);
write('IM-360', '# IM-360\n관련: \n상태: 완료\n마지막: 2026-09-20\n한 줄: 끝\n\n## 완료 조건\n- [ ] 남은 척\n');
write('옛-작업', '# 옛-작업\n상태: 진행 중\n마지막: 2026-01-01\n한 줄: 오래됨\n');
fs.writeFileSync(path.join(dir, 'INDEX.md'), '# 색인\n');
const old = path.join(dir, '옛-작업.md');
fs.utimesSync(old, new Date(Date.now() - 30 * 86400000), new Date(Date.now() - 30 * 86400000));

const cases = [];
const it = (name, fn) => cases.push([name, fn]);

it('머리 · 완료 조건 · 지킬 것을 읽는다', () => {
  const t = parseTopic(path.join(dir, '주문-목록.md'));
  assert.strictEqual(t.name, '주문-목록');
  assert.strictEqual(t.status, '진행 중');
  assert.strictEqual(t.summary, '서버 끝, 화면 남음');
  assert.strictEqual(t.hasCriteria, true);
  assert.deepStrictEqual(t.todo, ['화면 연결', '핸드오프 · TODO 갱신']);
  assert.deepStrictEqual(t.checked, ['서버 페이지네이션 테스트 통과']);
  assert.deepStrictEqual(t.keep, ['응답 봉투는 기존 관례대로', '목록 API 는 page 1 부터']);
});
it('완료 조건 절이 없으면 빈 목록, 머리가 없으면 기본값', () => {
  const t = parseTopic(old);
  assert.strictEqual(t.hasCriteria, false);
  assert.deepStrictEqual(t.todo, []);
  assert.deepStrictEqual(t.keep, []);
  assert.strictEqual(parseTopic(path.join(dir, '없음.md')), null);
});
it('INDEX.md 는 빼고 센다', () => {
  assert.deepStrictEqual(listTopics(tmp, 'kim').map((t) => t.name).sort(), ['IM-360', '옛-작업', '주문-목록']);
  assert.deepStrictEqual(listTopics(tmp, '없는사람'), []);
});
it('진행 중이고 최근에 손댄 것만 고른다 (완료 · 오래된 것 제외)', () => {
  const act = activeTopics(tmp, 'kim', Date.now() - 86400000, '2026-09-30');
  assert.deepStrictEqual(act.map((t) => t.name), ['주문-목록']);
  // 마지막: 이 오늘이면 수정 시각이 오래돼도 포함
  assert.deepStrictEqual(activeTopics(tmp, 'kim', Date.now() + 1000, '2026-09-30').map((t) => t.name), ['주문-목록']);
  assert.deepStrictEqual(activeTopics(tmp, 'kim', Date.now() + 1000, '2026-10-01').map((t) => t.name), []);
});

let failed = 0;
for (const [name, fn] of cases) {
  try { fn(); console.log(`✔ ${name}`); } catch (e) { failed++; console.log(`✖ ${name}\n  ${e.message}`); }
}
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
