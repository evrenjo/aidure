// 위임 진행 현황: 상대 도구의 진행 이벤트(JSONL)를 사람이 읽는 줄로. 쓰는 곳: bin/delegate.js status · watch · wait
/*
 * codex exec --json : { type: item.started | item.completed, item: { type: command_execution | file_change | agent_message | reasoning | todo_list | web_search | mcp_tool_call, … } }
 * claude -p --output-format stream-json --verbose : { type: assistant, message: { content: [{ type: tool_use, name, input } | { type: text, text }] } } · { type: result, result }
 * 줄 = 「읽기 <파일>」 · 「찾기 <무엇>」 · 「$ <명령>」 · 「편집 <파일>」 · 「할 일 n/m」 · 「말: …」 (워크스페이스 안 경로는 상대 경로로)
 */
'use strict';
const path = require('path');

/** JSONL 글 → 이벤트 목록 (깨진 줄 · 쓰는 중인 마지막 줄은 건너뛴다) */
function parse(text) {
  const out = [];
  for (const l of String(text || '').split('\n')) {
    if (!l.trim()) continue;
    try { out.push(JSON.parse(l)); } catch { /* 쓰는 중 */ }
  }
  return out;
}

const cut = (s, n = 110) => { const x = String(s || '').replace(/\s+/g, ' ').trim(); return x.length > n ? `${x.slice(0, n - 1)}…` : x; };
/** 셸 감싸기(/bin/zsh -lc '…')를 벗긴 명령 */
const bare = (c) => String(Array.isArray(c) ? c.join(' ') : c || '').replace(/^\S*\/(?:ba|z)?sh\s+-l?c\s+/, '').replace(/^'([\s\S]*)'$/, '$1').replace(/^"([\s\S]*)"$/, '$1');
const rel = (root, f) => { const s = String(f || ''); return root && s.startsWith(root + path.sep) ? s.slice(root.length + 1) : s; };

/** 이벤트 → 동작 [{ kind: read|search|cmd|edit|todo|say|think|web, text }] (같은 codex 항목의 시작 · 끝은 한 번) */
function steps(evs, meta = {}) {
  const root = meta.root || '';
  const out = [];
  const seen = new Set();
  for (const e of evs) {
    if (e.type === 'item.started' || e.type === 'item.completed') {
      const it = e.item || {};
      const key = `${it.id}:${it.type}`;
      if (it.type === 'agent_message') { if (e.type === 'item.completed') out.push({ kind: 'say', text: it.text }); continue; }
      if (it.type === 'todo_list') { const items = it.items || []; out.push({ kind: 'todo', text: `할 일 ${items.filter((x) => x.completed).length}/${items.length}${items.find((x) => !x.completed) ? ` · 지금: ${items.find((x) => !x.completed).text}` : ''}` }); continue; }
      if (seen.has(key)) continue;
      seen.add(key);
      if (it.type === 'command_execution') {
        const c = bare(it.command);
        const m = /^(?:cat|sed -n \S+|head(?: -n \d+)?|tail(?: -n \d+)?|nl -ba)\s+(\S+)\s*$/.exec(c);
        out.push(m ? { kind: 'read', text: rel(root, m[1].replace(/^['"]|['"]$/g, '')) } : /^(?:rg|grep|git grep|find)\b/.test(c) ? { kind: 'search', text: c } : { kind: 'cmd', text: c });
      } else if (it.type === 'file_change') out.push({ kind: 'edit', text: (it.changes || []).map((x) => rel(root, x.path)).join(', ') || '파일' });
      else if (it.type === 'reasoning') out.push({ kind: 'think', text: it.text || '' });
      else if (it.type === 'web_search') out.push({ kind: 'web', text: it.query || '' });
      else if (it.type === 'mcp_tool_call') out.push({ kind: 'cmd', text: `${it.server || ''} ${it.tool || ''}`.trim() });
      continue;
    }
    if (e.type === 'assistant' && e.message && Array.isArray(e.message.content)) {
      for (const c of e.message.content) {
        if (c.type === 'text' && c.text && c.text.trim()) out.push({ kind: 'say', text: c.text });
        if (c.type !== 'tool_use') continue;
        const i = c.input || {};
        if (c.name === 'Read') out.push({ kind: 'read', text: rel(root, i.file_path) });
        else if (c.name === 'Grep' || c.name === 'Glob') out.push({ kind: 'search', text: `${i.pattern || ''}${i.path ? ` (${rel(root, i.path)})` : ''}` });
        else if (c.name === 'Bash') out.push({ kind: 'cmd', text: i.command });
        else if (/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(c.name)) out.push({ kind: 'edit', text: rel(root, i.file_path || i.notebook_path) });
        else if (c.name === 'TodoWrite') { const t = i.todos || []; const now = t.find((x) => x.status === 'in_progress'); out.push({ kind: 'todo', text: `할 일 ${t.filter((x) => x.status === 'completed').length}/${t.length}${now ? ` · 지금: ${now.content}` : ''}` }); }
        else if (/^Web/.test(c.name)) out.push({ kind: 'web', text: i.query || i.url || '' });
        else out.push({ kind: 'cmd', text: c.name });
      }
    }
  }
  return out;
}

const LABEL = { read: '읽기', search: '찾기', cmd: '$', edit: '편집', todo: '☐', say: '말:', think: '생각 중', web: '웹' };
/** 사람이 읽는 동작 줄 */
function actions(evs, meta) {
  return steps(evs, meta).filter((s) => s.kind !== 'think').map((s) => `${LABEL[s.kind]} ${cut(s.text, s.kind === 'say' ? 140 : 110)}`);
}

/** 요약: { reads, searches, cmds, edits, last: [최근 동작 3], say: 최근 말, todo } */
function summarize(evs, meta, res) {
  const st = steps(evs, meta);
  const n = (k) => st.filter((s) => s.kind === k).length;
  const acts = st.filter((s) => !['say', 'think', 'todo'].includes(s.kind));
  const say = [...st].reverse().find((s) => s.kind === 'say');
  const todo = [...st].reverse().find((s) => s.kind === 'todo');
  return { reads: n('read'), searches: n('search'), cmds: n('cmd'), edits: n('edit'), last: acts.slice(-3).map((s) => `${LABEL[s.kind]} ${cut(s.text)}`), say: say ? cut(say.text, 160) : '', todo: todo ? todo.text : '', events: evs.length, done: !!res };
}

function render(s, meta, res) {
  const mins = (((res && res.endedAt) || Date.now()) - meta.startedAt) / 60000;
  const head = `${res ? (res.code === 0 ? '✔ 끝남' : `✖ 실패(${res.code})`) : '● 실행 중'} ${mins.toFixed(1)}분 · ${meta.role} → ${meta.to}${meta.model ? ` (${meta.model})` : ''}`;
  if (!s.events) return `${head}\n  아직 진행 기록이 없습니다 (시작하는 중이거나 진행 기록을 남기지 않는 옛 작업)`;
  return [head, `  읽은 파일 ${s.reads} · 찾기 ${s.searches} · 명령 ${s.cmds}${meta.mode === 'write' || s.edits ? ` · 편집 ${s.edits}` : ''}${s.todo ? ` · ${s.todo}` : ''}`,
    ...(s.last.length ? [`  최근: ${s.last.join('\n        ')}`] : []), ...(s.say ? [`  최근 말: ${s.say}`] : [])].join('\n');
}

/** claude stream-json 의 최종 답 (result, 없으면 응답 글을 이은 것) */
function finalText(evs) {
  const r = [...evs].reverse().find((e) => e.type === 'result');
  if (r && typeof r.result === 'string') return r.result;
  const said = steps(evs).filter((s) => s.kind === 'say').map((s) => s.text);
  return said.length ? said[said.length - 1] : '';
}

module.exports = { parse, steps, actions, summarize, render, finalText };
