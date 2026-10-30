// 작업별 기록(handoffs/<id>/topics/<작업>.md) 읽기 — 머리 · 완료 조건 · 지킬 것. 훅(task-check · task-focus)과 handoff.js 가 같이 쓴다. 의존성 없음
'use strict';
const fs = require('fs');
const path = require('path');

const two = (n) => String(n).padStart(2, '0');
const localDate = (d = new Date()) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;

/**
 * 파일 하나를 읽어 { name, status, last, summary, related, todo[], waiting[], checked[], scheduled[], later[], dueToday[], overdue[], badSchedule[], hasCriteria, keep[], mtime } 로. 못 읽으면 null.
 * [~] = 사용자 결정 대기 (점검에서 뺀다). [>] YYYY-MM-DD … = 날짜 예약: 그날 전에는 미완으로 세지 않고(later), 그날부터 todo 에 「오늘 예정」 · 지나면 「지난 예약」 으로 들어간다.
 * 날짜가 없거나 잘못된 [>] 는 badSchedule (handoff.js check 가 막는다). today = 'YYYY-MM-DD' (기본: 이 PC 의 오늘)
 */
function parseTopic(file, today) {
  let t;
  try { t = fs.readFileSync(file, 'utf8'); } catch { return null; }
  let mtime = 0;
  try { mtime = fs.statSync(file).mtimeMs; } catch { /* 방금 지워짐 */ }
  return { ...parseTopicText(t, path.basename(file, '.md'), today), file, mtime };
}

/** 본문 문자열 → 같은 모양 (file · mtime 없음). 원격(git show)에서 읽은 기록용. hasStatus = 상태: 줄이 있나 */
function parseTopicText(t, name, today = localDate()) {
  const head = (k) => ((t.match(new RegExp(`^${k}:\\s*(.*)$`, 'm')) || [])[1] || '').trim();
  const section = (name) => {
    const s = t.split(/^##\s+/m).find((x) => x.startsWith(name));
    return s ? s.slice(s.indexOf('\n') + 1) : '';
  };
  const items = (body, re) => body.split('\n').map((l) => l.match(re)).filter(Boolean).map((m) => m[1].trim()).filter(Boolean);
  const criteria = section('완료 조건');
  const scheduled = items(criteria, /^\s*[-*]\s+\[>\]\s+(.*)$/).map((raw) => {
    const m = /^(\d{4}-\d{2}-\d{2})(?:\s*\([^)]*\))?\s*(.*)$/.exec(raw);
    const d = m ? new Date(`${m[1]}T00:00:00`) : null;
    const date = d && !Number.isNaN(d.getTime()) && localDate(d) === m[1] ? m[1] : ''; // 2026-02-30 같은 없는 날짜는 뺀다
    return { date, text: m ? m[2] || raw : raw, raw };
  });
  const ok = scheduled.filter((x) => x.date);
  const dueToday = ok.filter((x) => x.date === today);
  const overdue = ok.filter((x) => x.date < today);
  const plain = items(criteria, /^\s*[-*]\s+\[ \]\s+(.*)$/);
  return {
    name,
    hasStatus: /^상태:\s*\S/m.test(t),
    status: head('상태') || '진행 중', last: head('마지막'), summary: head('한 줄'), related: head('관련'),
    hasCriteria: /^##\s+완료 조건/m.test(t),
    todo: [...plain, ...dueToday.map((x) => `[오늘 예정] ${x.text}`), ...overdue.map((x) => `[지난 예약 ${x.date.slice(5)}] ${x.text}`)],
    scheduled, later: ok.filter((x) => x.date > today), dueToday, overdue, badSchedule: scheduled.filter((x) => !x.date),
    checked: items(criteria, /^\s*[-*]\s+\[[xX]\]\s+(.*)$/),
    waiting: items(criteria, /^\s*[-*]\s+\[~\]\s+(.*)$/),
    keep: items(section('지킬 것'), /^\s*[-*]\s+(.*)$/),
  };
}

/** 본인 topics/ 전부 */
function listTopics(rootDir, id, today) {
  const dir = path.join(rootDir, 'handoffs', id, 'topics');
  let names;
  try { names = fs.readdirSync(dir); } catch { return []; }
  return names.filter((n) => n.endsWith('.md') && n !== 'INDEX.md').map((n) => parseTopic(path.join(dir, n), today)).filter(Boolean);
}

/** 진행 중이고 since(ms) 이후 손댄(또는 마지막: 이 오늘인) 작업. 최근 것부터 */
function activeTopics(rootDir, id, since, today) {
  return listTopics(rootDir, id, today)
    .filter((t) => t.status === '진행 중' && (t.mtime >= since || (today && t.last === today)))
    .sort((a, b) => b.mtime - a.mtime);
}

/** 날짜 예약이 오늘이거나 지난 진행 중 작업 (언제 손댔든). 세션 시작 줄 · 진행 중 작업 알림 · 브리핑이 쓴다 */
function dueTopics(rootDir, id, today = localDate()) {
  return listTopics(rootDir, id, today).filter((t) => t.status === '진행 중' && (t.dueToday.length || t.overdue.length));
}

/** 미완 작업 = 진행 중이고 완료 조건에 [ ] (또는 날짜가 된 [>]) 가 남은 기록. 남은 일의 정본은 이것이다 (TODO.md 는 사용자가 등록한 것만) */
const isOpen = (t) => t.status === '진행 중' && t.todo.length > 0;

module.exports = { parseTopic, parseTopicText, listTopics, activeTopics, dueTopics, isOpen, localDate };
