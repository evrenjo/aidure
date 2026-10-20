// 오래 일하는 팀원 · 위임 작업 찾기 — 경과가 상한(분)을 넘은 것을 리더에게 알린다. 아무것도 멈추지 않는다.
/*
 * 팀원 (Claude Code agent teams): 팀 설정 파일의 isActive. 일하기 시작한 시각은 리더 쪽 훅이 처음 "일하는 중" 으로 본 때다.
 *   대기로 바뀌면(TeammateIdle · isActive false) 기록을 지워 다음 일은 다시 센다
 * 위임 작업 (delegate.js): meta.json 의 startedAt. result.json 이 생기면 끝난 것
 * 기록 = 상태 폴더의 longrun.json { busy: { "<팀>:<이름>": 시각 }, warned: { 키: 시각 } }. 같은 대상은 상한만큼 지나 다시 알린다
 * 쓰는 곳: hooks/team-idle.js. 수준 · 상한은 bin/kit.js resolveModels 의 enforce.longRunning · longRun
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { stateDir } = require('./workspace');
const T = require('./teamidle');

const file = (ROOT) => path.join(stateDir(ROOT), 'longrun.json');
const load = (ROOT) => { try { return { busy: {}, warned: {}, ...JSON.parse(fs.readFileSync(file(ROOT), 'utf8')) }; } catch { return { busy: {}, warned: {} }; } };
const save = (ROOT, st) => fs.writeFileSync(file(ROOT), JSON.stringify(st));

/** 수준 · 상한(분). 옛 워크스페이스면 기본값 */
function settings(ROOT) {
  const d = { level: 'block', after: 60 };
  try {
    const kit = require(path.join(ROOT, 'bin', 'kit.js'));
    const r = kit.resolveModels(ROOT, kit.loadWorkspace(ROOT));
    return { level: (r.enforce || {}).longRunning || d.level, after: (r.longRun || d).after };
  } catch { return d; }
}

/** TeammateIdle: 그 팀원의 일 시작 기록을 지운다 */
function markIdle(ROOT, team, name) {
  if (!team || !name) return;
  const st = load(ROOT);
  const k = `${team}:${name}`;
  if (!(k in st.busy) && !(k in st.warned)) return;
  delete st.busy[k];
  delete st.warned[k];
  save(ROOT, st);
}

/** 끝나지 않은 위임 작업 [{ key, label, since }] (하루 지난 것은 버려진 것으로 본다) */
function delegations(ROOT) {
  const dir = path.join(stateDir(ROOT), 'delegate');
  let ids = [];
  try { ids = fs.readdirSync(dir); } catch { return []; }
  const day = Date.now() - 86400000;
  const out = [];
  for (const id of ids) {
    if (fs.existsSync(path.join(dir, id, 'result.json'))) continue;
    try {
      const m = JSON.parse(fs.readFileSync(path.join(dir, id, 'meta.json'), 'utf8'));
      if (m.startedAt > day) out.push({ key: `delegate:${id}`, label: `위임 ${m.role || id}${m.to ? ` → ${m.to}` : ''}`, since: m.startedAt });
    } catch { /* 깨진 기록 */ }
  }
  return out;
}

/** 상한을 넘었고 상한만큼 안에 알린 적 없는 것 [{ label, minutes }]. mark 면 알렸다고 적는다 */
function overrun(ROOT, sessionId, { after = 60 } = {}, { mark = true, now = Date.now() } = {}) {
  const st = load(ROOT);
  const before = JSON.stringify(st);
  const items = delegations(ROOT);
  const list = T.members(sessionId);
  if (list) {
    const team = T.teamOf(sessionId);
    for (const m of list) {
      const k = `${team}:${m.name}`;
      if (m.isActive === true) { if (!st.busy[k]) st.busy[k] = now; items.push({ key: k, label: m.name, since: st.busy[k] }); } else { delete st.busy[k]; delete st.warned[k]; }
    }
    for (const k of Object.keys(st.busy)) if (k.startsWith(`${team}:`) && !list.some((m) => `${team}:${m.name}` === k)) delete st.busy[k]; // 종료된 팀원
  }
  const live = new Set(items.map((x) => x.key));
  for (const k of Object.keys(st.warned)) if (!live.has(k)) delete st.warned[k];
  const out = [];
  for (const x of items) {
    const minutes = Math.floor((now - x.since) / 60000);
    if (minutes < after) continue;
    if (st.warned[x.key] && now - st.warned[x.key] < after * 60000) continue;
    out.push({ label: x.label, minutes });
    if (mark) st.warned[x.key] = now;
  }
  if (JSON.stringify(st) !== before) save(ROOT, st);
  return out;
}

/** 리더에게 줄 문구 */
function message(list, { after = 60 } = {}) {
  return `오래 일하는 중입니다: ${list.map((x) => `${x.label}(${x.minutes}분)`).join(', ')}. 상한 ${after}분. `
    + '계속할지 · 범위를 줄일지 · 멈추고 정리할지 사용자에게 선택지로 묻습니다 (지금까지 한 것 · 남은 것 한 줄씩). '
    + `같은 대상은 ${after}분 뒤에 다시 알립니다. 수준 바꾸기: aikit team-mode enforce run off|warn|block [--after 분]`;
}

module.exports = { settings, markIdle, delegations, overrun, message };
