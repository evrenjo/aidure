// 토론 모드 판정 (debate.js): 주장 · 판정 읽기 · 근거 없는 동의 · 합의 · 갈림 · 기각 · 패널 형식 · 패널 예시
'use strict';
const assert = require('assert');
const { parseClaims, parseVotes, verdict, parsePanel, suggest, summarize, formatEvent } = require('./debate');

// 주장: 「## 주장」 절 안의 강도 표시 줄만, 절이 없으면 전체에서
const r1 = '결론: 2건\n- [블로커] 본문 위쪽 줄은 절 밖\n## 주장\n- [블로커] 주문 상태 덮어씀 — order.js:3\n1. [권장] 이름 — a.js:1\n- 강도 없는 줄\n## 기타\n- [참고] 절 밖';
assert.deepStrictEqual(parseClaims(r1, '주장').map((c) => c.level), ['블로커', '권장']);
assert.strictEqual(parseClaims('- [참고] 절 없음 — x.md', '주장').length, 1, '절이 없으면 전체');
assert.strictEqual(parseClaims('## 놓친 것\n- [블로커] 없음. 앞에서 다뤘다', '놓친 것').length, 0, '「없음」 줄은 주장이 아니다');
assert.strictEqual(parseClaims(Array.from({ length: 20 }, (_, i) => `- [참고] ${i} — f:${i}`).join('\n'), '주장').length, 12, '최대 12개');

// 판정: 근거 없는 동의 · 반대는 보류 (lazy 표시), 굵게 · 번호도 읽는다
const v = parseVotes('## 판정\n- A1: 동의 — order.js:3 직접 확인함\n- **B1**: **반대** — 디버그 전용 로그라 운영에서 꺼짐\n- A2: 동의\n3. N1: 보류 — 확인 못 함\n## 놓친 것\n없음');
assert.strictEqual(v.A1.stance, 'agree');
assert.strictEqual(v.B1.stance, 'oppose');
assert.ok(v.A2.stance === 'hold' && v.A2.lazy, '근거 없는 동의는 보류');
assert.ok(v.N1.stance === 'hold' && !v.N1.lazy);
const vp = parseVotes('## 판정\n- A2: 보류 (강도는 권장) / calc.js:1 빈 배열은 NaN\n- A4: 동의 (참고) / 저장소 grep 으로 호출부 없음 확인\n- B1: 반대 디버그 전용 로그라 운영에서 꺼짐\n- B2: 동의 (참고)');
assert.ok(vp.A2.stance === 'hold' && /강도는 권장 \/ calc\.js:1/.test(vp.A2.why), '판정 뒤 괄호');
assert.strictEqual(vp.A4.stance, 'agree');
assert.strictEqual(vp.B1.stance, 'oppose', '구분 기호 없이 이어 쓴 근거');
assert.ok(vp.B2.stance === 'hold' && vp.B2.lazy, '괄호만 있고 근거가 없으면 보류');

// 상태: 판정한 모델 2개 이상이 모두 동의 = 합의, 모두 반대 = 기각, 하나 이하 = 한 모델만, 그 밖 = 갈림. 빠진 모델의 표는 세지 않는다
const c = (votes) => ({ votes: Object.fromEntries(Object.entries(votes).map(([w, s]) => [w, { stance: s }])) });
assert.strictEqual(verdict(c({ A: 'agree', B: 'agree' }), ['A', 'B']), 'agreed');
assert.strictEqual(verdict(c({ A: 'oppose', B: 'oppose' }), ['A', 'B']), 'rejected');
assert.strictEqual(verdict(c({ A: 'agree', B: 'oppose' }), ['A', 'B']), 'split');
assert.strictEqual(verdict(c({ A: 'agree', B: 'hold' }), ['A', 'B']), 'split', '보류가 있으면 갈림');
assert.strictEqual(verdict(c({ A: 'agree' }), ['A', 'B']), 'single', '낸 모델 표 하나뿐');
assert.strictEqual(verdict(c({ A: 'agree', B: 'oppose' }), ['A']), 'single', '빠진 모델 표는 세지 않음');
assert.strictEqual(verdict({ by: 'A', votes: { B: { stance: 'agree' } } }, ['A', 'B']), 'agreed', '낸 모델은 표가 없으면 동의');
assert.strictEqual(verdict({ by: 'A', votes: { A: { stance: 'oppose' }, B: { stance: 'oppose' } } }, ['A', 'B']), 'rejected', '낸 모델이 철회하면 그 표');
assert.strictEqual(verdict({ by: 'A', votes: { B: { stance: 'agree' } } }, ['B']), 'single', '낸 모델이 빠졌으면 세지 않음');

// 패널: 도구:모델[:effort[:관점]], 2~4개
assert.deepStrictEqual(parsePanel('codex:gpt-6.1-sol:high,claude:opus:xhigh:보안')[1], { tool: 'claude', model: 'opus', effort: 'xhigh', view: '보안' });
assert.throws(() => parsePanel('codex:a'), /2~4/);
assert.throws(() => parsePanel('gemini:x,claude:y'), /도구/);

// 패널 예시: 다른 회사 1위 → 같은 회사 1위 → 다른 회사 2위, 쓸 수 없는 모델은 빼고, 작업 종류마다 점수 칸이 다르다
const list = [
  { tool: 'claude', id: 'opus', ok: true, strengths: { '에이전트 코딩': 70, 코딩: 89, 언어: 80, '지시 따르기': 60 } },
  { tool: 'claude', id: 'haiku', ok: true, strengths: { '에이전트 코딩': 50, 코딩: 70, 언어: 95, '지시 따르기': 90 } },
  { tool: 'codex', id: 'sol', ok: true, strengths: { '에이전트 코딩': 55, 코딩: 80, 언어: 88, '지시 따르기': 70 } },
  { tool: 'codex', id: 'luna', ok: true, strengths: { '에이전트 코딩': 51, 코딩: 79, 언어: 70, '지시 따르기': 50 } },
  { tool: 'codex', id: 'off', ok: false, strengths: { '에이전트 코딩': 99, 코딩: 99 } },
];
assert.deepStrictEqual(suggest(list, 'code', 'claude').map((m) => m.id), ['sol', 'opus', 'luna']);
assert.deepStrictEqual(suggest(list, 'docs', 'claude').map((m) => m.id), ['sol', 'haiku', 'luna'], '문서는 언어 · 지시 따르기');
assert.deepStrictEqual(suggest(list, 'code', 'codex').map((m) => m.id), ['opus', 'sol', 'haiku'], 'Codex 세션이면 Claude 먼저');

// 진행 보기: 모델 하나의 보고 요약 · 화면 줄 (1차 = 주장, 2차 = 동의가 아닌 판정과 놓친 것만 펼친다)
const s1 = summarize(1, '## 주장\n- [블로커] 주문 상태 덮어씀 / order.js:3\n- [참고] 로그 많음 / log.js:2');
assert.deepStrictEqual(s1.claims.map((c) => c.level), ['블로커', '참고']);
const s2 = summarize(2, '## 판정\n- A1: 동의 / order.js:3 직접 확인\n- A2: 반대 / 디버그 전용이라 운영에서 꺼짐\n- B1: 동의\n## 놓친 것\n- [권장] 재시도 없음 / order.js:9');
assert.strictEqual(s2.votes.length, 3);
assert.strictEqual(s2.missed.length, 1);
const meta = { startedAt: 0, topic: '주문', rounds: 3, members: [{ who: 'A', tool: 'claude', model: 'opus' }, { who: 'B', tool: 'codex', model: 'sol' }] };
const lines = (ev) => formatEvent({ t: 60000, ...ev }, meta).join('\n');
assert.match(lines({ type: 'start' }), /토론 시작: 주문 · 패널 A claude:opus · B codex:sol/);
assert.match(lines({ type: 'member', n: 1, who: 'A', ok: true, ...s1 }), /A claude:opus 1차 끝 \(1\.0분\): 주장 2개\n {6}A1 \[블로커\] 주문 상태 덮어씀/);
const m2 = lines({ type: 'member', n: 2, who: 'B', ok: true, ...s2 });
assert.match(m2, /판정 3개 \(동의 1 · 반대 1 · 보류 1\) · 놓친 것 1개/);
assert.ok(/A2: 반대 \/ 디버그/.test(m2) && /B1: 보류 \(근거 없어 보류로 셈\)/.test(m2) && !/A1:/.test(m2), '동의는 접고 반대 · 보류만 펼친다');
assert.match(lines({ type: 'member', n: 1, who: 'B', ok: false, fail: '사용량 한도(429)' }), /✖ B codex:sol 1차 빠짐.*사용량 한도/);
assert.match(lines({ type: 'roundEnd', n: 2, claims: 4, tally: { agreed: 2, split: 1, rejected: 1, single: 0 }, splits: [{ id: 'A2', level: '참고', text: '로그 많음', votes: 'A 동의 · B 반대' }], next: '3차: 갈린 · 한 모델만 주장 1개' }),
  /2차 정리 \(1\.0분\): 주장 4개: 합의 2 · 갈림 1 · 기각 1 · 한 모델만 0\n {6}갈림 A2 \[참고\] 로그 많음 · A 동의 · B 반대\n {6}다음: 3차/);

console.log('debate.test.js ✔');
