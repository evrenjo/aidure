// 시간 예산 — 작업마다 예상 시간을 적어 두고 경과를 본다. bin/budget.js(선언) 와 hooks/budget-check.js(알림)가 같이 쓴다. 의존성 없음
// 기록: 상태 폴더의 budget.json [{ name, minutes, start, warned }]. 이 PC · 이 워크스페이스만. 끝낸 것 · 하루 지난 것은 지운다
'use strict';
const fs = require('fs');
const path = require('path');
const { stateDir } = require('./workspace');

const OVER = 1.5; // 예산의 이 배를 넘으면 알린다
const file = (root) => path.join(stateDir(root), 'budget.json');

function load(root) {
  let list = [];
  try { list = JSON.parse(fs.readFileSync(file(root), 'utf8')); } catch { /* 없음 */ }
  const day = Date.now() - 86400000;
  return (Array.isArray(list) ? list : []).filter((b) => b && b.name && b.minutes > 0 && b.start > day);
}
const save = (root, list) => fs.writeFileSync(file(root), JSON.stringify(list, null, 2));

/** "30" · "30m" · "30분" · "1h" · "1.5h" · "1시간" → 분. 못 읽으면 null */
function parseMinutes(s) {
  const m = String(s || '').trim().match(/^(\d+(?:\.\d+)?)\s*(m|min|분|h|시간)?$/i);
  if (!m) return null;
  const n = Number(m[1]) * (/^(h|시간)$/i.test(m[2] || '') ? 60 : 1);
  return n > 0 ? Math.round(n) : null;
}

const elapsed = (b, now = Date.now()) => Math.floor((now - b.start) / 60000);
const over = (b, now = Date.now()) => elapsed(b, now) > b.minutes * OVER;
const line = (b, now = Date.now()) => `${b.name} 예산 ${b.minutes}분 · 경과 ${elapsed(b, now)}분`;

module.exports = { OVER, load, save, parseMinutes, elapsed, over, line };
