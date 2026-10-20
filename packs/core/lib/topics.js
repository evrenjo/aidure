// 작업별 기록(handoffs/<id>/topics/<작업>.md) 읽기 — 머리 · 완료 조건 · 지킬 것. 훅(task-check · task-focus)과 handoff.js 가 같이 쓴다. 의존성 없음
'use strict';
const fs = require('fs');
const path = require('path');

/** 파일 하나를 읽어 { name, status, last, summary, related, todo[], waiting[], checked[], hasCriteria, keep[], mtime } 로. 못 읽으면 null. [~] = 사용자 결정 대기 (점검에서 뺀다) */
function parseTopic(file) {
  let t;
  try { t = fs.readFileSync(file, 'utf8'); } catch { return null; }
  let mtime = 0;
  try { mtime = fs.statSync(file).mtimeMs; } catch { /* 방금 지워짐 */ }
  return { ...parseTopicText(t, path.basename(file, '.md')), file, mtime };
}

/** 본문 문자열 → 같은 모양 (file · mtime 없음). 원격(git show)에서 읽은 기록용. hasStatus = 상태: 줄이 있나 */
function parseTopicText(t, name) {
  const head = (k) => ((t.match(new RegExp(`^${k}:\\s*(.*)$`, 'm')) || [])[1] || '').trim();
  const section = (name) => {
    const s = t.split(/^##\s+/m).find((x) => x.startsWith(name));
    return s ? s.slice(s.indexOf('\n') + 1) : '';
  };
  const items = (body, re) => body.split('\n').map((l) => l.match(re)).filter(Boolean).map((m) => m[1].trim()).filter(Boolean);
  const criteria = section('완료 조건');
  return {
    name,
    hasStatus: /^상태:\s*\S/m.test(t),
    status: head('상태') || '진행 중', last: head('마지막'), summary: head('한 줄'), related: head('관련'),
    hasCriteria: /^##\s+완료 조건/m.test(t),
    todo: items(criteria, /^\s*[-*]\s+\[ \]\s+(.*)$/),
    checked: items(criteria, /^\s*[-*]\s+\[[xX]\]\s+(.*)$/),
    waiting: items(criteria, /^\s*[-*]\s+\[~\]\s+(.*)$/),
    keep: items(section('지킬 것'), /^\s*[-*]\s+(.*)$/),
  };
}

/** 본인 topics/ 전부 */
function listTopics(rootDir, id) {
  const dir = path.join(rootDir, 'handoffs', id, 'topics');
  let names;
  try { names = fs.readdirSync(dir); } catch { return []; }
  return names.filter((n) => n.endsWith('.md') && n !== 'INDEX.md').map((n) => parseTopic(path.join(dir, n))).filter(Boolean);
}

/** 진행 중이고 since(ms) 이후 손댄(또는 마지막: 이 오늘인) 작업. 최근 것부터 */
function activeTopics(rootDir, id, since, today) {
  return listTopics(rootDir, id)
    .filter((t) => t.status === '진행 중' && (t.mtime >= since || (today && t.last === today)))
    .sort((a, b) => b.mtime - a.mtime);
}

/** 미완 작업 = 진행 중이고 완료 조건에 [ ] 가 남은 기록. 남은 일의 정본은 이것이다 (TODO.md 는 사용자가 등록한 것만) */
const isOpen = (t) => t.status === '진행 중' && t.todo.length > 0;

module.exports = { parseTopic, parseTopicText, listTopics, activeTopics, isOpen };
