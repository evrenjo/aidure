// 대기 팀원 점검 (Claude Code agent teams): 일을 마치고 대기(idle)로 오래 남은 팀원을 찾는다. 팀 설정 파일만 읽고 아무것도 종료하지 않는다.
/*
 * 팀원 목록 = <Claude 설정 폴더>/teams/session-<리더 세션 ID 앞 8자>/config.json 의 members (팀원마다 isActive: 일하는 중인가)
 *   종료 요청이 승인됐거나 TaskStop 으로 멈춘 팀원은 members 에서 빠진다
 * 대기 시작 시각은 TeammateIdle 훅(팀원 세션에서 돈다)이 적는다. 적힌 것이 없으면 리더 쪽 점검이 처음 본 때부터 센다
 * 기록 = 상태 폴더의 <팀 이름>.idle.json { idle: { 이름: 시각 }, warned: { 이름: 시각 } }
 * 쓰는 곳: hooks/team-idle.js. 수준 · 시간은 bin/kit.js resolveModels 의 enforce.idleTeammates · idle
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { stateDir } = require('./workspace');

const real = (p) => { try { return fs.realpathSync(p); } catch { return path.resolve(p); } };
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const safe = (s) => String(s || '').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 64);
const teamsDir = () => path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'teams');
/**
 * 리더 세션의 팀 이름. 기본은 session-<세션 ID 앞 8자>. 이어서 시작(-c · --resume)하면 세션 ID 가 바뀌어도 팀은 처음 ID 이름 그대로라,
 * 그 이름의 팀이 없으면 팀 설정의 leadSessionId · 대화 기록의 마지막 team_name 으로 찾는다. 인자는 세션 ID 나 훅 입력({ session_id, transcript_path })
 */
const teamCache = new Map();
function teamOf(x) {
  const sessionId = String((x && typeof x === 'object' ? x.session_id : x) || '');
  const transcript = x && typeof x === 'object' ? x.transcript_path : null;
  const own = `session-${sessionId.slice(0, 8)}`;
  const key = `${sessionId}\n${transcript || ''}`;
  if (teamCache.has(key)) return teamCache.get(key);
  const has = (t) => fs.existsSync(path.join(teamsDir(), t, 'config.json'));
  let team = own;
  if (sessionId && !has(own)) {
    let found = null;
    try { found = fs.readdirSync(teamsDir()).find((t) => (readJson(path.join(teamsDir(), t, 'config.json')) || {}).leadSessionId === sessionId) || null; } catch { /* 팀 폴더 없음 */ }
    if (!found && transcript) {
      try { // 끝에서 4MB 안의 마지막 team_name (팀원을 띄운 Agent 호출 입력에 있다)
        const fd = fs.openSync(transcript, 'r');
        const size = fs.fstatSync(fd).size;
        const len = Math.min(size, 4 * 1024 * 1024);
        const buf = Buffer.alloc(len);
        fs.readSync(fd, buf, 0, len, size - len);
        fs.closeSync(fd);
        const names = [...buf.toString('utf8').matchAll(/"team_name":"([A-Za-z0-9._-]+)"/g)].map((m) => m[1]);
        found = names.reverse().find(has) || null;
      } catch { /* 기록 없음 */ }
    }
    if (found) team = found;
  }
  teamCache.set(key, team);
  return team;
}
const file = (ROOT, team) => path.join(stateDir(real(ROOT)), `${safe(team)}.idle.json`);
const load = (ROOT, team) => ({ idle: {}, warned: {}, ...(readJson(file(ROOT, team)) || {}) });
const save = (ROOT, team, st) => fs.writeFileSync(file(ROOT, team), JSON.stringify(st));

/** 수준 · 시간(분). 옛 워크스페이스면 기본값 */
function settings(ROOT) {
  const d = { level: 'block', status: 'block', after: 10, remind: 30 };
  try {
    const kit = require(path.join(ROOT, 'bin', 'kit.js'));
    const r = kit.resolveModels(ROOT, kit.loadWorkspace(ROOT));
    return { level: (r.enforce || {}).idleTeammates || d.level, status: (r.enforce || {}).waitStatus || d.status, after: (r.idle || d).after, remind: (r.idle || d).remind };
  } catch { return d; }
}

/** TeammateIdle: 그 팀원의 대기 시작 시각을 적는다 */
function markIdle(ROOT, team, name, now = Date.now()) {
  if (!team || !name) return;
  const st = load(ROOT, team);
  st.idle[name] = now;
  delete st.warned[name];
  save(ROOT, team, st);
}

/** 리더 세션의 팀원 (리더 제외). 팀 설정 파일이 없으면 null */
function members(sessionId) {
  const c = readJson(path.join(teamsDir(), teamOf(sessionId), 'config.json')); // sessionId = 세션 ID 나 훅 입력 (teamOf)
  if (!c || !Array.isArray(c.members)) return null;
  return c.members.filter((m) => m && m.name && m.agentId !== c.leadAgentId && m.agentType !== 'team-lead');
}

/** 대기 after 분 이상이고, 같은 팀원을 remind 분 안에 알린 적이 없는 팀원 [{ name, minutes }]. mark 면 알렸다고 적는다 */
function overdue(ROOT, sessionId, { after = 10, remind = 30 } = {}, { mark = true, now = Date.now() } = {}) {
  const list = members(sessionId);
  if (!list) return [];
  const team = teamOf(sessionId);
  const st = load(ROOT, team);
  const before = JSON.stringify(st);
  const names = new Set(list.map((m) => m.name));
  for (const k of Object.keys(st.idle)) if (!names.has(k)) delete st.idle[k]; // 종료된 팀원
  for (const k of Object.keys(st.warned)) if (!names.has(k)) delete st.warned[k];
  const out = [];
  for (const m of list) {
    if (m.isActive === true) { delete st.idle[m.name]; delete st.warned[m.name]; continue; } // 다시 일하는 중
    if (m.isActive !== false && !st.idle[m.name]) continue; // 상태 필드가 없는 판: TeammateIdle 기록이 있을 때만 대기로 본다
    if (!st.idle[m.name]) st.idle[m.name] = now;
    const minutes = Math.floor((now - st.idle[m.name]) / 60000);
    if (minutes < after) continue;
    if (st.warned[m.name] && now - st.warned[m.name] < remind * 60000) continue;
    out.push({ name: m.name, minutes });
    if (mark) st.warned[m.name] = now;
  }
  if (JSON.stringify(st) !== before) save(ROOT, team, st);
  return out;
}

/** 리더에게 줄 문구 */
function message(list, { remind = 30 } = {}) {
  return `일을 마치고 대기 중인 팀원이 있습니다: ${list.map((x) => `${x.name}(대기 ${x.minutes}분)`).join(', ')}. `
    + '다시 맡길 일이 없으면 팀원마다 정식 종료 요청(SendMessage 의 shutdown_request)을 보내고, 몇 분 지나도 팀원 목록에 남아 있으면 TaskStop(task_id 에 팀원 이름)으로 멈춥니다. '
    + `남겨 둘 것이면 사용자 보고에 "대기 중: <역할> · 사유" 한 줄을 적습니다. 같은 팀원은 ${remind}분 뒤에 다시 알립니다. 수준 바꾸기: aikit team-mode enforce idle off|warn|block`;
}

/**
 * 리더가 턴을 끝낼 때 남아 있는 것. Stop 훅 입력의 background_tasks([{ type: shell | teammate …, status, description, command }])와 팀 설정 파일로 본다
 * 팀원은 대기 중이어도 background_tasks 에 running 으로 오므로 일하는 중 · 대기는 팀 설정 파일의 isActive 로 가른다
 * → { bg: [설명], working: [이름], idle: [이름], any }
 */
function waiting(input) {
  const tasks = Array.isArray(input && input.background_tasks) ? input.background_tasks : [];
  const bg = tasks.filter((t) => t && t.type !== 'teammate' && (!t.status || t.status === 'running')).map((t) => String(t.description || t.command || t.type || '작업').replace(/\s+/g, ' ').slice(0, 60));
  const list = members(input || {}) || [];
  const working = list.filter((m) => m.isActive === true).map((m) => m.name);
  const idle = list.filter((m) => m.isActive !== true).map((m) => m.name);
  return { bg, working, idle, any: !!(bg.length || working.length || idle.length) };
}

/** 답변에 상태 줄(「지금 도는 것:」으로 시작하는 줄)이 있는가 */
const hasStatus = (text) => /^[\s>*-]*\**지금 도는 것\**\s*[::]/m.test(String(text || ''));

const leftText = (w) => [w.bg.length ? `리더의 백그라운드 작업 ${w.bg.length}개(${w.bg.join(', ')})` : '', w.working.length ? `일하는 중인 팀원 ${w.working.join(', ')}` : '', w.idle.length ? `대기 중인 팀원 ${w.idle.join(', ')}` : ''].filter(Boolean).join(' · ');

/** 상태 줄이 없을 때 리더에게 줄 문구 */
function statusMessage(w) {
  return `남아 있는 것이 있는데 답변에 상태 줄이 없습니다 (${leftText(w)}). 사용자는 화면의 팀원 목록만으로 일하는 중과 대기를 구분하지 못합니다. `
    + '답변 끝에 한 줄을 적습니다: "지금 도는 것: <무엇, 없으면 없음> · 예상 종료: <언제쯤, 모르면 모름> · 사용자가 할 일: <있음(무엇) | 없음>". 대기 중인 팀원은 일하는 것으로 적지 않고 "대기 중: <역할> · 사유" 로 적습니다. 수준 바꾸기: aikit team-mode enforce status off|block';
}

/** 끝남 알림에 덧붙일 한 줄. 남은 것이 없으면 '' */
function summary(w) {
  if (!w.any) return '';
  return `⏳ 일하는 팀원 ${w.working.length} · 대기 팀원 ${w.idle.length} · 리더 백그라운드 작업 ${w.bg.length}개${w.bg.length ? ' 대기 중' : ''}`;
}

module.exports = { settings, markIdle, members, overdue, message, teamOf, waiting, hasStatus, statusMessage, summary };
