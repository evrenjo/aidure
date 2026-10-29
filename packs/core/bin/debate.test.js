// 토론 모드 판정 (debate.js): 주장 · 판정 읽기 · 근거 없는 동의 · 합의 · 갈림 · 기각 · 패널 형식 · 패널 예시
'use strict';
const assert = require('assert');
const { parseClaims, parseVotes, verdict, parsePanel, suggest } = require('./debate');

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

console.log('debate.test.js ✔');
