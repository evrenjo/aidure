#!/usr/bin/env node
// 토론 모드: 여러 모델(다른 회사 우선)이 같은 문제를 따로 보고, 이름을 가린 주장 목록에 서로 동의 · 반대해 갈린 것만 다시 본다. 실행: node packs/core/bin/delegate.js 를 회차마다 부른다
/*
 *   models [--task code|design|docs]      이 PC 에서 쓸 수 있는 모델 (설치된 CLI · kedovi ai 설정 · 로그인 요금제) 과 강점 점수, 작업에 맞춘 패널 예시
 *   start --panel 도구:모델[:effort[:관점]],… [--role 역할] [--rounds N] [--topic 라벨]   작업 지시서는 stdin (또는 --task-file)
 *        패널 2~4개. 도구 = codex | claude. 관점 = 보안 · 성능 · 반대 역할 같은 맡을 시각(선택). 역할 기본 reviewer (설계는 architect, 요구는 analyst)
 *        rounds = 최대 회차 (기본 3, 2~4): 1차 따로 보기 → 2차 서로 판정 → 3차부터 갈린 주장만
 *        → 토론 id 를 출력하고 바로 끝난다. 패널이 이 PC 에 없으면 시작하지 않는다 (같은 회사 모델로 몰래 바꾸지 않는다)
 *   wait <id> [--timeout 초(기본 900)]    끝날 때까지 기다려 결과(합의 · 갈림 · 기각 · 한 모델만 · 빠진 모델)를 보여 준다
 *   wait <id> --round [--timeout 초(기본 540)]   (리더 중계용) 회차가 끝날 때마다 돌아와 그 회차의 주장 · 판정을 보여 준다. 끝났으면 결과까지
 *   watch [<id>]                          (사용자용) 다른 터미널에서 모델별 주장 · 판정 · 회차 정리를 실시간으로 본다
 *   status [<id>]                         지금 회차 · 모델별 상태
 *   list                                  이 워크스페이스의 토론
 *   run …                                 (내부) start 가 떼어 낸 진행 프로세스
 *   --dry-run                             실행하지 않고 패널 · 회차 · 1차 지시서만
 * 결과의 주장도 주장이다: 리더가 발견마다 직접 확인해 판정한다 (debate 스킬).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { load, stateDir } = require('../lib/workspace');
const { findCli } = require('../lib/cli');
const { REVIEW_ROLE, hasCheckLine, CHECK_MESSAGE, checkLevel } = require('../lib/review');

const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = (k, d = null) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const has = (k) => argv.includes(`--${k}`);

// 명령으로 돌 때만 워크스페이스를 읽는다 (판정 함수는 시험에서 따로 쓴다)
const MAIN = require.main === module;
const ws = MAIN ? load() : null;
const ROOT = ws ? ws.root : null;
const DIR = ROOT ? path.join(stateDir(ROOT), 'debate') : null;
const DELEGATE = path.join(__dirname, 'delegate.js');
if (DIR) fs.mkdirSync(DIR, { recursive: true });

const LETTERS = ['A', 'B', 'C', 'D'];
const LEVELS = ['블로커', '권장', '참고'];
const STANCES = { 동의: 'agree', 반대: 'oppose', 보류: 'hold' };

// ───────── 쓸 수 있는 모델 ─────────

const TASK_FIELDS = { code: ['에이전트 코딩', '코딩'], design: ['추론', '데이터 분석'], docs: ['언어', '지시 따르기'] };

/** 세션을 연 도구 (Claude Code 는 CLAUDECODE · Codex 는 CODEX_* 환경변수) */
function caller(env = process.env) {
  if (env.CLAUDECODE === '1' || env.CLAUDE_CODE_ENTRYPOINT) return 'claude';
  if (Object.keys(env).some((k) => k.startsWith('CODEX_'))) return 'codex';
  return null;
}

/** 이 PC 에서 쓸 수 있는 모델: 설치된 CLI · kedovi ai 의 회사 설정 · 퇴역 · 목록에서 빠진 모델 제외 */
function usable() {
  let kit = null;
  try { kit = require(path.join(ROOT, 'bin', 'kit.js')); } catch { /* 옛 워크스페이스 */ }
  let cat = {};
  try { cat = JSON.parse(fs.readFileSync(path.join(ROOT, 'packs', 'core', 'models.json'), 'utf8')); } catch { /* 없음 */ }
  let access = { vendors: ['claude', 'codex'] };
  let plans = {};
  try { access = kit.resolveModels(ROOT, kit.loadWorkspace(ROOT)).access || access; } catch { /* 기본 */ }
  try { plans = kit.detectPlans(cat); } catch { /* 모름 */ }
  const retired = (cat.retired || []).map((r) => ({ tool: r.tool, re: new RegExp(r.match) }));
  const out = [];
  for (const tool of ['claude', 'codex']) {
    const cli = findCli(tool);
    const allowed = (access.vendors || []).includes(tool);
    for (const m of (cat.tools || {})[tool] || []) {
      if (m.id === 'opusplan' || /목록에서 빠짐/.test(m.hint || '') || retired.some((r) => r.tool === tool && r.re.test(m.id))) continue;
      const st = (m.strengths || [])[0] || {};
      const price = ((m.hint || '').match(/API (\$[\d.]+·\$[\d.]+)/) || [])[1] || '';
      out.push({ tool, id: m.id, label: m.label, hint: (m.hint || '').replace(/\s*\(API[^)]*\)/, ''), strengths: st, price, ok: !!cli && allowed, why: !cli ? `${tool} 가 설치돼 있지 않음` : !allowed ? '이 PC 설정(kedovi ai)이 이 회사 모델을 쓰지 않음' : '' });
    }
  }
  return { list: out, plans, access, cat };
}

/** 작업 종류에 맞는 패널 예시: 다른 회사 1위 → 같은 회사 1위 → 다른 회사 2위 (쓸 수 있는 것만) */
function suggest(list, task, leader) {
  const f = TASK_FIELDS[task] || TASK_FIELDS.code;
  const score = (m) => f.reduce((s, k) => s + (Number(m.strengths[k]) || 0), 0);
  const ok = list.filter((m) => m.ok && score(m) > 0).sort((a, b) => score(b) - score(a));
  const other = ok.filter((m) => m.tool !== (leader || 'claude'));
  const same = ok.filter((m) => m.tool === (leader || 'claude'));
  const pick = [other[0], same[0], other[1] || same[1]].filter(Boolean);
  return [...new Map(pick.map((m) => [`${m.tool}:${m.id}`, m])).values()].slice(0, 3);
}

function models() {
  const task = opt('task', 'code');
  const leader = caller();
  const { list, plans, cat } = usable();
  const f = TASK_FIELDS[task] || TASK_FIELDS.code;
  console.log(`이 PC 에서 쓸 수 있는 모델 (작업: ${task} · 강점 점수 = LiveBench ${f.join(' + ')}${leader ? ` · 지금 세션: ${leader === 'claude' ? 'Claude Code' : 'Codex'}` : ''})`);
  for (const tool of ['claude', 'codex']) {
    const rows = list.filter((m) => m.tool === tool);
    if (!rows.length) continue;
    const pl = plans[tool] && plans[tool].id ? ((cat.plans || {})[tool] || []).find((x) => x.id === plans[tool].id) : null;
    const plan = pl ? ` · 요금제 ${pl.label}` : '';
    console.log(`\n${tool === 'claude' ? 'Claude (도구 claude)' : 'GPT (도구 codex)'}${plan}`);
    for (const m of rows) {
      const sc = f.map((k) => (m.strengths[k] != null ? `${k} ${m.strengths[k]}` : '')).filter(Boolean).join(' · ') || '독립 점수 없음';
      console.log(`  ${m.ok ? '✔' : '✖'} ${tool}:${m.id}  ${m.label} · ${m.hint}${m.price ? ` · API ${m.price}` : ''} · ${sc}${m.ok ? '' : ` (${m.why})`}`);
    }
  }
  const s = suggest(list, task, leader);
  if (s.length >= 2) console.log(`\n패널 예시 (다른 회사 먼저): --panel ${s.map((m) => `${m.tool}:${m.id}:high`).join(',')}`);
  else console.log('\n⚠ 쓸 수 있는 모델이 2개가 안 돼 토론할 수 없습니다. 다른 회사 CLI 를 설치 · 로그인하거나 kedovi ai 에서 두 회사를 켠다');
  console.log('고르는 기준: 다른 회사 모델을 꼭 넣는다 (같은 모델끼리는 다수결로 끝난다) · 작업의 강점 점수 · 리더(지금 세션) 모델과 다른 것 · 비싼 모델은 하나만');
}

// ───────── 주장 · 판정 읽기 ─────────

/** 1차 · 놓친 것: `- [블로커|권장|참고] 주장 / 근거` */
function parseClaims(text, section) {
  const lines = sectionLines(text, section);
  const out = [];
  for (const l of lines) {
    const m = l.match(/^\s*(?:[-*]|\d+\.)\s*\[(블로커|권장|참고)\]\s*(.+)$/);
    if (m && !/^(?:없음|없다|해당\s*없음|none)(?:[\s.,:/]|$)/i.test(m[2].trim())) out.push({ level: m[1], text: m[2].trim().slice(0, 400) });
  }
  return out.slice(0, 12);
}

/** 절(## 제목) 안의 줄. 절이 없으면 전체 */
function sectionLines(text, title) {
  const lines = String(text || '').split('\n');
  const i = lines.findIndex((l) => new RegExp(`^#{1,4}\\s*${title}`).test(l.trim()));
  if (i < 0) return lines;
  const rest = lines.slice(i + 1);
  const j = rest.findIndex((l) => /^#{1,4}\s/.test(l.trim()));
  return j < 0 ? rest : rest.slice(0, j);
}

/** 판정: `- A1: 동의|반대|보류 / 근거`. 근거 없는 동의는 보류로 센다 */
function parseVotes(text) {
  const out = {};
  for (const l of sectionLines(text, '판정')) {
    // 판정 뒤 괄호(「보류 (강도는 권장)」)와 구분 기호 없이 이어 쓴 근거도 읽는다
    const m = l.match(/^\s*(?:[-*]|\d+\.)?\s*\**([A-DN]\d+)\**\s*[:：]\s*\**(동의|반대|보류)\**\s*(?:[(（]([^)）]*)[)）])?\s*(?:[—–\-/|:：]+\s*)?(.*)$/);
    if (!m) continue;
    const why = [m[3], m[4]].map((x) => (x || '').trim()).filter(Boolean).join(' / ');
    let stance = STANCES[m[2]];
    if (stance !== 'hold' && why.replace(/\s/g, '').length < 8) stance = 'hold';
    out[m[1]] = { stance, why: why.slice(0, 300), lazy: STANCES[m[2]] !== 'hold' && stance === 'hold' };
  }
  return out;
}

/** 주장 하나의 상태: 합의 = 판정한 모델(2개 이상)이 모두 동의 · 기각 = 모두 반대 · 판정한 모델이 하나 이하면 한 모델만 · 그 밖은 갈림. 낸 모델은 따로 표가 없으면 동의로 센다 */
function verdict(c, active) {
  const votes = { ...(c.by && active.includes(c.by) && !c.votes[c.by] ? { [c.by]: { stance: 'agree' } } : {}), ...c.votes };
  const v = Object.entries(votes).filter(([who]) => active.includes(who)).map(([, x]) => x.stance);
  const agree = v.filter((s) => s === 'agree').length;
  const oppose = v.filter((s) => s === 'oppose').length;
  if (v.length < 2) return 'single';
  if (agree && !oppose && agree === v.length) return 'agreed';
  if (oppose && !agree && oppose === v.length) return 'rejected';
  return 'split';
}

// ───────── 지시서 ─────────

function round1(task, p, n) {
  return [task.trim(), '', '# 토론 1차: 따로 보기', '',
    `이 문제를 다른 AI 모델 ${n - 1}개도 따로 보고 있다. 서로의 답은 보지 않는다. 다음 회차에 모델들이 서로의 주장을 근거로 판정한다.`,
    p.view ? `너의 관점: **${p.view}** (이 시각에서 특히 본다. 다른 문제도 보이면 적는다)` : '',
    '보고 끝에 `## 주장` 절을 두고 주장(발견 · 의견 · 제안)을 한 줄씩 적는다 (최대 12개):',
    '- [블로커|권장|참고] 주장 / 근거 (파일:줄 · 재현 입력 · 문서 위치 · 출처)',
    '근거를 댈 수 없는 것은 [참고] 로 둔다. 같은 내용을 여러 줄로 나누지 않는다.'].filter((l) => l !== '').join('\n');
}

function claimLine(c) { return `- ${c.id} [${c.level}] ${c.text}`; }

function round2(task, claims) {
  return [task.trim(), '', '# 토론 2차: 서로 판정', '',
    '1차에서 모델들이 따로 낸 주장이다. 누가 냈는지는 가렸고 네 주장도 섞여 있다. 코드 · 문서를 직접 확인해 하나씩 판정한다.',
    '- 동의는 확인한 근거(파일:줄 · 본 내용)를 댄다. 근거 없는 동의는 보류로 센다.',
    '- 반대는 왜 틀렸는지(사실과 다른 곳 · 반례 · 범위 밖)를 댄다. 강도(블로커 · 권장)만 틀렸으면 반대하고 맞는 강도를 적는다.',
    '- 많은 쪽을 따르지 말고 증거를 따른다. 확인할 수 없으면 보류.',
    '', '`## 판정` 절에 주장마다 한 줄:', '- A1: 동의|반대|보류 / 근거',
    '그다음 `## 놓친 것` 절에 모두가 놓친 주장을 1차 형식(`- [블로커|권장|참고] 주장 / 근거`)으로. 없으면 「없음」.',
    '', '# 주장 목록', '', ...claims.map(claimLine)].join('\n');
}

function roundN(task, claims, n) {
  const body = [];
  for (const c of claims) {
    body.push(claimLine(c));
    for (const [who, v] of Object.entries(c.votes)) body.push(`  - 모델 ${who}: ${({ agree: '동의', oppose: '반대', hold: '보류' })[v.stance]}${v.why ? ` / ${v.why}` : ''}`);
  }
  return [task.trim(), '', `# 토론 ${n}차: 갈린 주장 다시 보기`, '',
    '아래 주장은 모델들의 판정이 갈렸거나 앞 회차에 새로 나왔다. 다른 모델의 근거를 읽고 코드 · 문서를 다시 확인해 최종 판정한다. 근거가 더 강한 쪽으로 바꿔도 된다. 버티기 위한 반대는 하지 않는다.',
    '', '`## 판정` 절에 주장마다 한 줄: `- A1: 동의|반대|보류 / 근거`. 새 주장은 내지 않는다.',
    '', '# 갈린 주장', '', ...body].join('\n');
}

// ───────── 실행 ─────────

function parsePanel(s) {
  const list = String(s || '').split(',').map((x) => x.trim()).filter(Boolean).map((x) => {
    const [tool, model, effort, ...view] = x.split(':');
    if (!['codex', 'claude'].includes(tool) || !model) throw new Error(`패널 형식: 도구:모델[:effort[:관점]] (도구 = codex | claude). 받은 값: ${x}`);
    return { tool, model, effort: effort || null, view: view.join(':') || null };
  });
  if (list.length < 2 || list.length > 4) throw new Error('패널은 2~4개입니다');
  return list;
}

function readTask() {
  const f = opt('task-file');
  if (f) return fs.readFileSync(path.resolve(f), 'utf8');
  if (process.stdin.isTTY) return '';
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

const save = (id, name, data) => fs.writeFileSync(path.join(DIR, id, name), typeof data === 'string' ? data : JSON.stringify(data, null, 2));
const readJson = (id, name) => { try { return JSON.parse(fs.readFileSync(path.join(DIR, id, name), 'utf8')); } catch { return null; } };

// ───────── 진행 기록 (events.jsonl): watch 가 실시간으로 보여 주고, wait --round 가 회차마다 리더에게 돌려준다 ─────────

const event = (id, ev) => { try { fs.appendFileSync(path.join(DIR, id, 'events.jsonl'), `${JSON.stringify({ t: Date.now(), ...ev })}\n`); } catch { /* 기록은 부가 기능 */ } };
const events = (id) => { try { return fs.readFileSync(path.join(DIR, id, 'events.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };
const short = (s, n = 110) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
const STANCE_TEXT = { agree: '동의', oppose: '반대', hold: '보류' };

/** 모델 하나의 회차 보고 → 화면에 보일 요약 (1차 = 주장, 2차부터 = 판정 · 놓친 것) */
function summarize(n, out) {
  if (n === 1) return { claims: parseClaims(out, '주장').map((c) => ({ level: c.level, text: short(c.text) })) };
  const votes = Object.entries(parseVotes(out)).map(([cid, v]) => ({ id: cid, stance: v.stance, lazy: !!v.lazy, why: short(v.why, 80) }));
  return { votes, missed: n === 2 ? parseClaims(out, '놓친 것').map((c) => ({ level: c.level, text: short(c.text) })) : [] };
}

/** 진행 기록 한 줄 → 사람이 읽는 줄들 */
function formatEvent(ev, meta) {
  const name = (who) => { const m = (meta.members || []).find((x) => x.who === who); return m ? `${who} ${m.tool}:${m.model}${m.view ? `(${m.view})` : ''}` : who; };
  const at = `${(((ev.t || Date.now()) - meta.startedAt) / 60000).toFixed(1)}분`;
  if (ev.type === 'start') return [`▶ 토론 시작${meta.topic ? `: ${meta.topic}` : ''} · 패널 ${meta.members.map((m) => name(m.who)).join(' · ')} · 최대 ${meta.rounds}회`];
  if (ev.type === 'round') {
    const what = ev.n === 1 ? '각자 따로 보고 주장을 낸다' : ev.n === 2 ? `이름을 가린 주장 ${ev.open}개에 서로 동의 · 반대 (근거 필수) + 놓친 것` : `갈린 주장 ${ev.open}개만 다시 판정`;
    return ['', `── ${ev.n}차 시작 (${at}): ${what} · ${ev.active.map(name).join(' · ')}`];
  }
  if (ev.type === 'member') {
    if (!ev.ok) return [`  ✖ ${name(ev.who)} ${ev.n}차 빠짐 (${at}): ${ev.fail || '실패'} · 다른 모델로 대신하지 않는다`];
    const L = [];
    if (ev.claims) {
      L.push(`  ● ${name(ev.who)} ${ev.n}차 끝 (${at}): 주장 ${ev.claims.length}개`);
      ev.claims.forEach((c, i) => L.push(`      ${ev.who}${i + 1} [${c.level}] ${c.text}`));
    } else {
      const k = (s) => ev.votes.filter((v) => v.stance === s).length;
      L.push(`  ● ${name(ev.who)} ${ev.n}차 끝 (${at}): 판정 ${ev.votes.length}개 (동의 ${k('agree')} · 반대 ${k('oppose')} · 보류 ${k('hold')})${ev.missed && ev.missed.length ? ` · 놓친 것 ${ev.missed.length}개` : ''}`);
      for (const v of ev.votes.filter((x) => x.stance !== 'agree' || x.lazy)) L.push(`      ${v.id}: ${STANCE_TEXT[v.stance]}${v.lazy ? ' (근거 없어 보류로 셈)' : ''}${v.why ? ` / ${v.why}` : ''}`);
      for (const c of ev.missed || []) L.push(`      + [${c.level}] ${c.text}`);
    }
    return L;
  }
  if (ev.type === 'roundEnd') {
    const c = ev.tally;
    const L = [`  ═ ${ev.n}차 정리 (${at}): 주장 ${ev.claims}개${ev.n === 1 ? '' : `: 합의 ${c.agreed} · 갈림 ${c.split} · 기각 ${c.rejected} · 한 모델만 ${c.single}`}`];
    for (const s of ev.splits || []) L.push(`      갈림 ${s.id} [${s.level}] ${s.text} · ${s.votes}`);
    if (ev.next) L.push(`      다음: ${ev.next}`);
    return L;
  }
  if (ev.type === 'end') return ['', `■ 토론 끝 (${at}): ${ev.summary}`];
  return [];
}

function start() {
  const panel = parsePanel(opt('panel'));
  const role = opt('role', 'reviewer');
  const rounds = Math.min(4, Math.max(2, Number(opt('rounds', 3)) || 3));
  const task = readTask();
  if (!task.trim()) throw new Error('작업 지시서가 비었습니다. stdin 이나 --task-file 로 주세요');
  // Codex 샌드박스 안이면 회차마다 부르는 위임이 모두 네트워크에서 막힌다: 시작 전에 멈춰 샌드박스 밖 실행 승인을 받게 한다
  if (process.env.CODEX_SANDBOX_NETWORK_DISABLED === '1') {
    console.log('✖ Codex 샌드박스 안이라 네트워크가 막혀 토론 모델을 부를 수 없습니다. 이 start 명령을 샌드박스 밖에서 실행하도록 사용자 승인을 요청해 다시 실행하세요 (wait · status 는 샌드박스 안에서 된다)');
    process.exit(4);
  }
  const missing = [...new Set(panel.map((p) => p.tool))].filter((t) => !findCli(t));
  if (missing.length) { console.log(`✖ ${missing.join(' · ')} 가 이 PC 에 없어 토론을 시작하지 않습니다. 패널에서 빼거나 설치 · 로그인한 뒤 다시 (같은 회사 모델로 대신하지 않는다. 쓸 수 있는 모델: node packs/core/bin/debate.js models)`); process.exit(3); }
  if (REVIEW_ROLE.test(role) && !hasCheckLine(task) && checkLevel(ROOT) === 'block') { console.log(`✖ ${CHECK_MESSAGE}`); process.exit(6); }
  const vendors = new Set(panel.map((p) => p.tool));
  const letters = LETTERS.slice(0, panel.length).sort(() => Math.random() - 0.5);
  const members = panel.map((p, i) => ({ ...p, who: letters[i] })).sort((a, b) => a.who.localeCompare(b.who));
  const id = `${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}-debate-${process.pid}`;
  const meta = { id, role, rounds, topic: opt('topic') || '', members, startedAt: Date.now() };
  const warn = vendors.size < 2 ? '⚠ 패널이 모두 같은 회사 모델입니다. 같은 회사 모델끼리는 의견이 비슷해 다수결로 끝나기 쉽습니다 (가능하면 다른 회사 모델을 넣는다)' : '';
  if (has('dry-run')) {
    console.log(JSON.stringify({ ...meta, warn: warn || undefined, round1: `${round1(task, members[0], members.length).slice(-600)}` }, null, 2));
    return;
  }
  fs.mkdirSync(path.join(DIR, id), { recursive: true });
  save(id, 'meta.json', meta);
  save(id, 'task.md', task);
  event(id, { type: 'start' });
  const child = spawn(process.execPath, [__filename, 'run', '--debate', id], { cwd: ROOT, detached: true, stdio: 'ignore' });
  child.unref();
  console.log(`토론 시작: ${members.map((m) => `${m.tool}:${m.model}${m.effort ? `·${m.effort}` : ''}${m.view ? `(${m.view})` : ''}`).join(' · ')} · 역할 ${role} · 최대 ${rounds}회`);
  if (warn) console.log(warn);
  console.log(`토론 id: ${id}`);
  console.log(`다음 (리더): node packs/core/bin/debate.js wait ${id} --round 를 회차마다 다시 불러 끝난 회차를 사용자에게 중계한다 (회차마다 모델들이 동시에 돈다)`);
  console.log(`사용자에게 알린다: 다른 터미널에서 kedovi debate watch ${id} 로 모델별 주장 · 판정을 실시간으로 볼 수 있다`);
}

/** 위임 하나 시작 → 작업 id */
function delegateStart(id, m, text, n) {
  const f = path.join(DIR, id, `round-${n}-${m.who}.task.md`);
  fs.writeFileSync(f, text);
  const r = spawnSync(process.execPath, [DELEGATE, 'start', '--to', m.tool, '--role', readJson(id, 'meta.json').role, '--mode', 'read', '--model', m.model,
    ...(m.effort ? ['--effort', m.effort] : []), '--group', id, '--task-file', f], { cwd: ROOT, encoding: 'utf8' });
  const job = (r.stdout.match(/작업 id: (\S+)/) || [])[1];
  return job ? { job } : { error: (r.stdout + r.stderr).trim().split('\n').slice(-2).join(' ') || `종료 코드 ${r.status}` };
}

/** 작업 끝까지 → { ok, out, fail } */
function delegateWait(job) {
  const res = spawnSync(process.execPath, [DELEGATE, 'wait', job, '--timeout', String(Number(process.env.KEDOVI_DEBATE_TIMEOUT) || 1500)], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const text = res.stdout || '';
  const fail = (text.match(/⚠ 실패 원인: ([^\n]+)/) || text.match(/⚠ (실패|보고가 비었음)[^\n]*/) || [])[1] || (res.status === 2 ? '시간 초과 (아직 도는 중)' : '');
  const out = text.split(/\n## \S+ 의 보고\n/)[1] || '';
  return { ok: res.status === 0 && !!out.trim() && !/^\(보고 없음\)/.test(out.trim()), out, fail: fail || (res.status !== 0 ? `종료 코드 ${res.status}` : '') };
}

/** 한 회차: 살아 있는 모델에게 동시에 → 모델별 보고 */
async function runRound(id, n, active, textFor, open = null) {
  const meta = readJson(id, 'meta.json');
  const st = readJson(id, 'state.json');
  st.round = n;
  save(id, 'state.json', st);
  event(id, { type: 'round', n, active, open: open == null ? undefined : open });
  const started = active.map((who) => {
    const m = meta.members.find((x) => x.who === who);
    return { who, ...delegateStart(id, m, textFor(m), n) };
  });
  const results = {};
  await Promise.all(started.map((s) => new Promise((ok) => {
    if (s.error) { results[s.who] = { ok: false, fail: s.error }; event(id, { type: 'member', n, who: s.who, ok: false, fail: s.error }); ok(); return; }
    // wait 는 동기 실행이라 하위 프로세스로 돌려 회차 안의 모델이 동시에 끝나기를 기다린다
    const c = spawn(process.execPath, [__filename, 'wait-job', '--job', s.job], { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] });
    let buf = '';
    c.stdout.on('data', (d) => { buf += d; });
    c.on('close', () => {
      try { results[s.who] = { ...JSON.parse(buf), job: s.job }; } catch { results[s.who] = { ok: false, fail: '결과를 읽지 못함', job: s.job }; }
      const r = results[s.who];
      event(id, { type: 'member', n, who: s.who, ok: !!r.ok, fail: r.ok ? undefined : r.fail, ...(r.ok ? summarize(n, r.out) : {}) });
      ok();
    });
  })));
  for (const [who, r] of Object.entries(results)) fs.writeFileSync(path.join(DIR, id, `round-${n}-${who}.md`), r.out || `(실패: ${r.fail})`);
  return results;
}

async function run() {
  const id = opt('debate');
  const meta = readJson(id, 'meta.json');
  const task = fs.readFileSync(path.join(DIR, id, 'task.md'), 'utf8');
  const st = { round: 0, claims: [], dropped: {}, lazy: {}, history: [] };
  save(id, 'state.json', st);
  let active = meta.members.map((m) => m.who);
  const drop = (results, n) => {
    for (const [who, r] of Object.entries(results)) if (!r.ok) { st.dropped[who] = `${n}차: ${r.fail || '실패'}`; active = active.filter((x) => x !== who); }
  };
  // 1차: 따로
  const r1 = await runRound(id, 1, active, (m) => round1(task, m, meta.members.length));
  Object.assign(st, readJson(id, 'state.json'));
  drop(r1, 1);
  for (const [who, r] of Object.entries(r1)) if (r.ok) parseClaims(r.out, '주장').forEach((c, i) => st.claims.push({ id: `${who}${i + 1}`, by: who, round: 1, ...c, votes: {} }));
  st.history.push({ round: 1, active: [...active], claims: st.claims.length });
  save(id, 'state.json', st);
  roundEnd(id, 1, st, active, meta);
  // 2차 ~ : 판정 (2차는 전부, 3차부터 갈린 것 · 새로 나온 것만)
  let newCount = 0;
  for (let n = 2; n <= meta.rounds && active.length >= 2; n++) {
    const open = n === 2 ? st.claims : st.claims.filter((c) => verdict(c, active) === 'split' || verdict(c, active) === 'single');
    if (!open.length) break;
    const rn = await runRound(id, n, active, () => (n === 2 ? round2(task, open) : roundN(task, open, n)), open.length);
    Object.assign(st, { round: n });
    drop(rn, n);
    for (const [who, r] of Object.entries(rn)) {
      if (!r.ok) continue;
      const votes = parseVotes(r.out);
      for (const c of open) if (votes[c.id]) { c.votes[who] = votes[c.id]; if (votes[c.id].lazy) st.lazy[who] = (st.lazy[who] || 0) + 1; }
      if (n === 2) parseClaims(r.out, '놓친 것').forEach((c) => { newCount++; st.claims.push({ id: `N${newCount}`, by: who, round: 2, ...c, votes: { [who]: { stance: 'agree', why: '(낸 모델)' } } }); });
    }
    st.history.push({ round: n, active: [...active], open: open.length });
    save(id, 'state.json', st);
    roundEnd(id, n, st, active, meta);
  }
  const endedAt = Date.now();
  const rep = report(meta, st, active, endedAt);
  save(id, 'result.json', { endedAt, active, report: rep });
  event(id, { type: 'end', summary: rep.split('\n')[1] });
  notifyDone(meta, active, endedAt);
}

/** 회차 끝: 집계 · 갈린 주장 · 다음 회차를 기록하고 (알림을 켰으면) 한 줄 알린다 */
function roundEnd(id, n, st, active, meta) {
  const tally = { agreed: 0, split: 0, rejected: 0, single: 0 };
  for (const c of st.claims) tally[verdict(c, active)]++;
  const votesOf = (c) => Object.entries(c.votes).map(([w, v]) => `${w} ${STANCE_TEXT[v.stance]}`).join(' · ');
  const splits = n === 1 ? [] : st.claims.filter((c) => verdict(c, active) === 'split').map((c) => ({ id: c.id, level: c.level, text: short(c.text, 80), votes: votesOf(c) }));
  const openNext = st.claims.filter((c) => ['split', 'single'].includes(verdict(c, active))).length;
  const next = active.length < 2 ? '판정할 모델이 2개가 안 돼 멈춘다' : n >= meta.rounds ? '최대 회차라 끝낸다' : n === 1 ? (st.claims.length ? `2차: 주장 ${st.claims.length}개를 서로 판정` : '주장이 없어 끝낸다') : openNext ? `${n + 1}차: 갈린 · 한 모델만 주장 ${openNext}개` : '모두 판정이 맞아 끝낸다';
  event(id, { type: 'roundEnd', n, claims: st.claims.length, tally, splits, next });
  if (/끝낸다|멈춘다/.test(next)) return; // 마지막 회차는 토론 끝 알림 하나로
  notifyRound(meta, n, st.claims.length, tally, next);
}

async function notifyRound(meta, n, claims, tally, next) {
  try {
    const notify = require('../lib/notify');
    const cfg = notify.personal(ROOT, ws);
    if (!notify.wantsProgress(cfg) || !cfg.token || !cfg.chat || notify.atDesk(cfg)) return;
    const mins = ((Date.now() - meta.startedAt) / 60000).toFixed(1);
    await notify.send(`🤖 [${notify.projectName(ROOT, ws)}] 토론 ${n}차 끝 (${mins}분): 주장 ${claims}개${n === 1 ? '' : ` · 합의 ${tally.agreed} · 갈림 ${tally.split}`} · 다음 ${next}`, cfg);
  } catch { /* 알림은 부가 기능 */ }
}

function report(meta, st, active, endedAt) {
  const name = (who) => { const m = meta.members.find((x) => x.who === who); return `${who}=${m.tool}:${m.model}${m.view ? `(${m.view})` : ''}`; };
  const by = { agreed: [], split: [], rejected: [], single: [] };
  for (const c of st.claims) by[verdict(c, active)].push(c);
  const stanceText = { agree: '동의', oppose: '반대', hold: '보류' };
  const votesOf = (c) => Object.entries(c.votes).map(([w, v]) => `${w} ${stanceText[v.stance]}`).join(' · ');
  const mins = ((endedAt - meta.startedAt) / 60000).toFixed(1);
  const L = [`# 토론 결과${meta.topic ? `: ${meta.topic}` : ''} · 패널 ${meta.members.map((m) => name(m.who)).join(' · ')} · ${st.round}회 · ${mins}분`,
    `주장 ${st.claims.length}개: 합의 ${by.agreed.length} · 갈림 ${by.split.length} · 기각 ${by.rejected.length} · 한 모델만 ${by.single.length}`];
  const out = Object.entries(st.dropped);
  if (out.length) L.push('', `⚠ 빠진 모델 (다른 모델로 대신하지 않았다): ${out.map(([w, why]) => `${name(w)} ${why}`).join(' · ')}`);
  if (active.length < 2) L.push('', '⚠ 판정할 모델이 2개가 안 돼 토론이 중간에 멈췄습니다. 남은 주장은 한 모델 의견입니다');
  const lazy = Object.entries(st.lazy);
  if (lazy.length) L.push('', `근거 없는 동의 · 반대는 보류로 셈: ${lazy.map(([w, k]) => `${w} ${k}건`).join(' · ')}`);
  const sec = (title, list, detail) => {
    if (!list.length) return;
    L.push('', `## ${title} (${list.length})`);
    for (const c of LEVELS.flatMap((lv) => list.filter((x) => x.level === lv))) {
      L.push(`- ${c.id} [${c.level}] ${c.text} · 낸 모델 ${c.by} · ${votesOf(c) || '판정 없음'}`);
      if (detail) for (const [w, v] of Object.entries(c.votes)) if (v.why && v.why !== '(낸 모델)') L.push(`  - ${w} ${stanceText[v.stance]}: ${v.why}`);
    }
  };
  sec('합의', by.agreed, false);
  sec('갈림: 양쪽 근거', by.split, true);
  sec('기각 (판정한 모델 모두 반대)', by.rejected, true);
  sec('한 모델만 (다른 모델이 판정하지 못함)', by.single, false);
  L.push('', '## 다음 (리더)', '주장도 주장이다. 발견마다 파일:줄을 직접 열어 확인됨 · 추정 · 기각으로 판정한다. 갈린 것은 양쪽 근거를 놓고 판정하고, 못 하면 사용자에게 선택지로 묻는다. 고치는 것은 사용자가 요청할 때만.',
    `원문: ${path.join(DIR, meta.id)} (round-<회차>-<모델>.md)`);
  return L.join('\n');
}

async function notifyDone(meta, active, endedAt) {
  try {
    const notify = require('../lib/notify');
    const cfg = notify.personal(ROOT, ws);
    const sec = (endedAt - meta.startedAt) / 1000;
    if (!notify.wantsProgress(cfg) || !cfg.token || !cfg.chat || sec < cfg.minSeconds || notify.atDesk(cfg)) return;
    await notify.send(`🤖 [${notify.projectName(ROOT, ws)}] 토론 끝: 모델 ${active.length}/${meta.members.length} · ${(sec / 60).toFixed(1)}분\n결과: node packs/core/bin/debate.js wait ${meta.id}`, cfg);
  } catch { /* 알림은 부가 기능 */ }
}

/** (내부) 위임 작업 하나를 기다려 JSON 한 줄 */
function waitJob() {
  process.stdout.write(JSON.stringify(delegateWait(opt('job'))));
}

async function wait() {
  const id = argv[1];
  if (!id || !readJson(id, 'meta.json')) throw new Error(`토론 id 가 없습니다: ${id} (목록: node packs/core/bin/debate.js list)`);
  if (has('round')) return waitRound(id);
  const limit = Number(opt('timeout', 900)) * 1000;
  const t0 = Date.now();
  while (!readJson(id, 'result.json')) {
    if (Date.now() - t0 > limit) { statusOf(id); console.log(`다시: node packs/core/bin/debate.js wait ${id}`); process.exit(2); }
    await new Promise((r) => setTimeout(r, 3000));
  }
  console.log(readJson(id, 'result.json').report);
}

/** 회차가 끝날 때마다 돌아온다: 지난번 뒤로 생긴 진행을 보여 주고 (리더가 사용자에게 중계), 끝났으면 결과까지 */
async function waitRound(id) {
  const meta = readJson(id, 'meta.json');
  const cur = path.join(DIR, id, 'relay.json');
  let from = 0;
  try { from = JSON.parse(fs.readFileSync(cur, 'utf8')).seen || 0; } catch { /* 처음 */ }
  const limit = Number(opt('timeout', 540)) * 1000;
  const t0 = Date.now();
  for (;;) {
    const evs = events(id);
    const fresh = evs.slice(from);
    const done = !!readJson(id, 'result.json');
    const stop = fresh.some((e) => e.type === 'roundEnd' || e.type === 'end') || done || Date.now() - t0 > limit;
    if (stop) {
      for (const e of fresh) for (const l of formatEvent(e, meta)) console.log(l);
      fs.writeFileSync(cur, JSON.stringify({ seen: evs.length }));
      if (done) { console.log(`\n${readJson(id, 'result.json').report}`); return; }
      if (!fresh.some((e) => e.type === 'roundEnd')) statusOf(id);
      console.log(`\n(리더) 위 진행을 사용자에게 몇 줄로 중계한 뒤 다시: node packs/core/bin/debate.js wait ${id} --round`);
      return;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
}

/** 사용자용 실시간 보기: 지금까지의 진행을 보여 주고 끝날 때까지 새 진행을 이어 붙인다 */
async function watch() {
  const ids = fs.readdirSync(DIR).sort();
  const id = (argv[1] && !argv[1].startsWith('--') ? argv[1] : null) || ids.filter((x) => !readJson(x, 'result.json')).slice(-1)[0] || ids.slice(-1)[0];
  if (!id || !readJson(id, 'meta.json')) return console.log('토론 없음');
  const meta = readJson(id, 'meta.json');
  console.log(`토론 ${id} 보기 (끝나면 저절로 닫힌다. 그만 보기: Ctrl+C)`);
  let seen = 0;
  let quiet = Date.now();
  for (;;) {
    const evs = events(id);
    for (const e of evs.slice(seen)) for (const l of formatEvent(e, meta)) console.log(l);
    if (evs.length > seen) quiet = Date.now();
    seen = evs.length;
    const res = readJson(id, 'result.json');
    if (res) { console.log(`결과 전체: kedovi debate wait ${id}`); return; }
    if (Date.now() - quiet > 120000) {
      const st = readJson(id, 'state.json') || { round: 0, dropped: {} };
      const doneWho = meta.members.filter((m) => fs.existsSync(path.join(DIR, id, `round-${st.round}-${m.who}.md`)) || evs.some((e) => e.type === 'member' && e.n === st.round && e.who === m.who)).map((m) => m.who);
      const running = meta.members.filter((m) => !doneWho.includes(m.who) && !st.dropped[m.who]).map((m) => `${m.who} ${m.tool}:${m.model}`);
      console.log(`  … ${st.round}차 진행 중 (${((Date.now() - meta.startedAt) / 60000).toFixed(1)}분)${running.length ? ` · 아직 도는 모델: ${running.join(' · ')}` : ''}`);
      quiet = Date.now();
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

function statusOf(id) {
  const meta = readJson(id, 'meta.json');
  const st = readJson(id, 'state.json') || { round: 0, claims: [], dropped: {} };
  const res = readJson(id, 'result.json');
  const mins = (((res ? res.endedAt : Date.now()) - meta.startedAt) / 60000).toFixed(1);
  console.log(`토론 ${id} · ${res ? '끝' : `${st.round}/${meta.rounds}차 진행 중`} · ${mins}분 · 주장 ${st.claims.length}개`);
  for (const m of meta.members) {
    const done = fs.existsSync(path.join(DIR, id, `round-${st.round}-${m.who}.md`));
    console.log(`  ${m.who} ${m.tool}:${m.model}${m.view ? `(${m.view})` : ''}  ${st.dropped[m.who] ? `빠짐 (${st.dropped[m.who]})` : res || done ? `${st.round}차 끝` : `${st.round}차 도는 중`}`);
  }
}

function status() {
  const ids = fs.readdirSync(DIR).sort();
  const id = argv[1] || ids.filter((x) => !readJson(x, 'result.json')).slice(-1)[0] || ids.slice(-1)[0];
  if (!id) return console.log('토론 없음');
  statusOf(id);
}

function list() {
  const ids = fs.readdirSync(DIR).sort();
  if (!ids.length) return console.log('토론 없음');
  for (const id of ids) {
    const meta = readJson(id, 'meta.json') || {};
    console.log(`${id}  ${readJson(id, 'result.json') ? '끝' : '진행 중'}  ${meta.topic || ''}  ${(meta.members || []).map((m) => `${m.tool}:${m.model}`).join(' · ')}`);
  }
}

if (MAIN) {
  (async () => {
    try {
      if (cmd === 'models') models();
      else if (cmd === 'start') start();
      else if (cmd === 'run') await run();
      else if (cmd === 'wait') await wait();
      else if (cmd === 'wait-job') waitJob();
      else if (cmd === 'status') status();
      else if (cmd === 'watch') await watch();
      else if (cmd === 'list') list();
      else { console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(3, 16).map((l) => l.replace(/^ \* ?/, '')).join('\n')); process.exit(!cmd || /^(?:-h|--help|help)$/.test(cmd) ? 0 : 1); }
    } catch (e) { console.error(`✖ ${e.message}`); process.exit(1); }
  })();
}

module.exports = { parseClaims, parseVotes, verdict, parsePanel, suggest, summarize, formatEvent };
