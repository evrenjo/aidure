// delegate-progress.js 점검: codex --json · claude stream-json 진행 이벤트 → 사람이 읽는 줄 · 요약 · 최종 답. 실행: node delegate-progress.test.js
'use strict';
const assert = require('assert');
const P = require('./delegate-progress');

const codex = [
  { type: 'thread.started' },
  { type: 'item.completed', item: { id: 'i0', type: 'agent_message', text: '확인하겠습니다' } },
  { type: 'item.started', item: { id: 'i1', type: 'command_execution', command: "/bin/zsh -lc 'git diff HEAD'", status: 'in_progress' } },
  { type: 'item.completed', item: { id: 'i1', type: 'command_execution', command: "/bin/zsh -lc 'git diff HEAD'", status: 'completed' } },
  { type: 'item.completed', item: { id: 'i2', type: 'command_execution', command: "/bin/zsh -lc 'sed -n 1,80p /w/src/a.js'" } },
  { type: 'item.completed', item: { id: 'i3', type: 'command_execution', command: "/bin/zsh -lc 'rg -n foo src'" } },
  { type: 'item.completed', item: { id: 'i4', type: 'file_change', changes: [{ path: '/w/src/a.js' }] } },
  { type: 'item.completed', item: { id: 'i5', type: 'agent_message', text: '블로커 없음' } },
];
const meta = { role: 'reviewer', to: 'codex', startedAt: Date.now() - 90000, root: '/w', mode: 'write' };
assert.deepStrictEqual(P.actions(codex, meta), ['말: 확인하겠습니다', '$ git diff HEAD', '읽기 src/a.js', '찾기 rg -n foo src', '편집 src/a.js', '말: 블로커 없음'], '시작 · 끝 이벤트는 한 번, 셸 감싸기 벗김, 상대 경로');
const s = P.summarize(codex, meta);
assert.deepStrictEqual([s.reads, s.searches, s.cmds, s.edits, s.say], [1, 1, 1, 1, '블로커 없음']);
assert.match(P.render(s, meta), /● 실행 중 1\.5분 · reviewer → codex\n {2}읽은 파일 1 · 찾기 1 · 명령 1 · 편집 1/);

const claude = P.parse([
  JSON.stringify({ type: 'system', subtype: 'init' }),
  JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read', input: { file_path: '/w/AGENTS.md' } }] } }),
  JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Grep', input: { pattern: 'TODO', path: '/w/src' } }, { type: 'tool_use', name: 'TodoWrite', input: { todos: [{ content: '읽기', status: 'completed' }, { content: '판정', status: 'in_progress' }] } }] } }),
  JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: '결론: 괜찮음' }] } }),
  JSON.stringify({ type: 'result', subtype: 'success', result: '결론: 괜찮음\n\n사실 …' }),
  '{"type":"assis',   // 쓰는 중인 마지막 줄
].join('\n'));
assert.deepStrictEqual(P.actions(claude, { root: '/w' }), ['읽기 AGENTS.md', '찾기 TODO (src)', '☐ 할 일 1/2 · 지금: 판정', '말: 결론: 괜찮음']);
assert.strictEqual(P.finalText(claude), '결론: 괜찮음\n\n사실 …', '최종 답 = result');
assert.match(P.render(P.summarize([], meta), meta), /아직 진행 기록이 없습니다/);
console.log('delegate-progress.test.js ✔');
