#!/usr/bin/env node
// GitLab MR 미리보기·생성 · 파이프라인 조회 · 작업 실행 도우미 (머지는 하지 않는다). 사용: node packs/gitlab/bin/gitlab-mr.js <preview|create|pipeline|repos> --repo <name> … (파이프라인은 kedovi gitlab pipeline 으로도)
'use strict';

/*
 * preview  --repo R --source S [--target T]
 *     커밋 목록(머지 제외, 오래된 순) · 기존 열린 MR · 제안 remove_source_branch 를 출력. 아무것도 만들지 않는다.
 * create   --repo R --source S [--target T] --title "..." --description-file F
 *          [--assignee <username>] [--remove-source true|false] [--dry-run]
 *     MR 을 만든다. --dry-run 이면 보낼 요청만 출력한다 (토큰은 가린다).
 * pipeline [--repo R] [--ref 브랜치 | --mr 번호 | --id 파이프라인ID] [--limit N] [--log [줄 수]] [--json]
 *     최근 파이프라인 목록(기본 5개)과 맨 위(또는 --id) 파이프라인의 단계별 작업 상태. 읽기만 한다 (작업 실행은 아래 --play · --retry).
 *     --repo 는 gitlab 설정이 있는 repo 가 하나면 생략. --log 는 실패한 작업의 로그 끝부분(기본 40줄).
 * pipeline --id ID --play <작업> | --retry <작업> [--repo R] [--yes] [--timeout 분]
 *     수동 작업 실행(--play: 앞 작업이 끝나 manual 이 될 때까지 기다린 뒤) · 실패한 작업 다시 실행(--retry). 끝날 때까지 상태를 보여 준다.
 *     --yes 가 없으면 무엇을 실행할지와 확인 문구만 보이고 멈춘다 (끝 코드 3). 운영 배포 작업은 사용자 승인 뒤에만 --yes 로 부른다.
 * repos    workspace.json repos 중 gitlab 설정이 있는 것 목록
 *
 * 설정: workspace.json repos[].gitlab = { host, projectId, apiBase? }
 * 토큰: 환경변수 GITLAB_TOKEN (vars.gitlab.tokenEnv 로 이름 변경) → 비밀값 저장소(kedovi secret: 프로젝트 > 전역 > 옛 ~/.config/kedovi/gitlab-token) → 없으면 git credential fill.
 * 토큰은 어떤 출력에도 찍지 않는다. 머지·auto-merge · 파이프라인 취소 API 는 이 도구에 없다.
 * 의존성 없음 (Node 18+ fetch).
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function loadWs() {
  // packs/gitlab/bin → 워크스페이스 루트의 core 헬퍼
  let load;
  try { ({ load } = require(path.join(__dirname, '..', '..', 'core', 'lib', 'workspace.js'))); } catch { load = null; }
  if (load) return load();
  let dir = process.cwd();
  for (;;) {
    const f = path.join(dir, 'workspace.json');
    if (fs.existsSync(f)) {
      const ws = JSON.parse(fs.readFileSync(f, 'utf8'));
      ws.root = dir;
      ws.repos = (ws.repos || []).map((x) => ({ ...x, dir: path.join(dir, 'repos', ...(x.group ? [x.group] : []), x.name) }));
      return ws;
    }
    const up = path.dirname(dir);
    if (up === dir) throw new Error('workspace.json 을 찾지 못했습니다');
    dir = up;
  }
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq > 0) out[a.slice(2, eq)] = a.slice(eq + 1);
      else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) out[a.slice(2)] = argv[++i];
      else out[a.slice(2)] = true;
    } else out._.push(a);
  }
  return out;
}

const die = (m) => { console.error(`✖ ${m}`); process.exit(1); };
const git = (dir, args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

function vars(ws) { return (ws.vars && ws.vars.gitlab) || {}; }

function repoOf(ws, name) {
  if (!name) die('--repo 가 필요합니다');
  const r = ws.repos.find((x) => x.name === name);
  if (!r) die(`workspace.json repos 에 '${name}' 이 없습니다`);
  if (!r.gitlab || !r.gitlab.host || r.gitlab.projectId === undefined) die(`repos '${name}' 에 "gitlab": {"host", "projectId"} 가 없습니다`);
  return r;
}

/** --repo 생략: gitlab 설정이 있는 repo 가 하나뿐이면 그것 */
function repoOrOnly(ws, name) {
  if (name && name !== true) return repoOf(ws, name);
  const list = ws.repos.filter((x) => x.gitlab && x.gitlab.host && x.gitlab.projectId !== undefined);
  if (list.length === 1) return list[0];
  die(list.length ? `--repo 가 필요합니다 (${list.map((x) => x.name).join(' · ')})` : 'gitlab 설정이 있는 repo 가 없습니다. workspace.json repos[].gitlab = {host, projectId}');
}

/** apiBase 는 gitlab.host 와 같은 호스트의 https 일 때만 (토큰을 그 주소로 보낸다) */
function apiBase(r) {
  const S = require(path.join(__dirname, '..', '..', 'core', 'lib', 'secrets.js'));
  const base = S.gitlabApi(r.gitlab.host, r.gitlab.apiBase);
  if (!base) throw new Error(`gitlab.apiBase(${r.gitlab.apiBase}) 가 gitlab.host(${r.gitlab.host}) 와 다르거나 https 가 아니라 토큰을 보내지 않습니다`);
  return base;
}

/** 토큰 → { value, from } (값은 출력하지 않는다. from 은 어디서 읽었는지) */
function token(ws, r) {
  const envName = vars(ws).tokenEnv || 'GITLAB_TOKEN';
  if (process.env[envName]) return { value: process.env[envName], from: `환경변수 ${envName}` };
  try {
    const S = require(path.join(__dirname, '..', '..', 'core', 'lib', 'secrets.js'));
    const g = S.get('GITLAB_TOKEN', { root: ws.root });
    if (g) return { value: g.value, from: g.label };
  } catch { /* 옛 워크스페이스: 저장소 없음 */ }
  try {
    const out = execFileSync('git', ['credential', 'fill'], { input: `protocol=https\nhost=${r.gitlab.host}\n\n`, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
    const m = out.match(/^password=(.*)$/m);
    if (m) return { value: m[1], from: 'git credential' };
  } catch { /* 자격증명 없음 */ }
  return null;
}

async function api(ws, r, method, p, body) {
  const t = token(ws, r);
  if (!t) throw new Error('토큰이 없습니다. 터미널에서 kedovi secret set GITLAB_TOKEN (숨김 입력, 권한 api)');
  const res = await fetch(`${apiBase(r)}/projects/${encodeURIComponent(r.gitlab.projectId)}${p}`, {
    method,
    headers: { 'PRIVATE-TOKEN': t.value, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  if (res.status === 401) throw new Error(`HTTP 401: 토큰이 거부됐습니다 (${t.from}).${t.from === 'git credential' ? ' git 계정 비밀번호는 API 에 쓸 수 없습니다.' : ' 만료 · 취소됐을 수 있습니다.'} 개인 액세스 토큰(권한 api)을 터미널에서 kedovi secret set GITLAB_TOKEN 으로 넣고 kedovi secret test GITLAB_TOKEN 으로 확인하세요`);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${typeof data === 'string' ? data.slice(0, 300) : JSON.stringify(data.message || data).slice(0, 300)}`);
  return data;
}

/** 머지 뒤 source 를 지울지 (제안값). 지우지 않는 것: 영구 브랜치(vars.branch) · 상시 작업 브랜치(vars.gitlab.persistentBranches) · 원격 기본 브랜치 · hotfix/* */
function defaultRemoveSource(ws, source, defaultBranch) {
  const b = (ws.vars && ws.vars.branch) || {};
  const permanent = [b.develop || 'develop', b.release || 'release', defaultBranch].filter(Boolean);
  const persistent = vars(ws).persistentBranches || [];
  if (permanent.includes(source) || persistent.includes(source)) return false;
  if (source.startsWith('hotfix/')) return false; // MR 2건(release·develop)이 같은 source 를 쓴다
  return true;
}

/** 원격 기본 브랜치 (GitLab 프로젝트 설정). 못 읽으면 null */
async function defaultBranchOf(ws, r) {
  try { return (await api(ws, r, 'GET', '')).default_branch || null; } catch { return null; }
}

function commits(r, source, target) {
  if (!fs.existsSync(r.dir)) throw new Error(`${r.dir} 가 없습니다. kedovi install (또는 node bin/kit.js install)`);
  git(r.dir, ['fetch', '-q', 'origin', target, source]);
  const out = git(r.dir, ['log', '--no-merges', '--reverse', '--format=%h%x09%s', `origin/${target}..origin/${source}`]);
  return out ? out.split('\n').map((l) => { const [sha, ...s] = l.split('\t'); return { sha, subject: s.join('\t') }; }) : [];
}

function unpushed(r, source) {
  try { return Number(git(r.dir, ['rev-list', '--count', `origin/${source}..${source}`])); } catch { return null; }
}

async function cmdPreview(ws, a) {
  const r = repoOf(ws, a.repo);
  const source = a.source; const target = a.target || (ws.vars && ws.vars.branch && ws.vars.branch.develop) || 'develop';
  if (!source) die('--source 가 필요합니다');
  if (source === target) die('source 와 target 이 같습니다');
  const list = commits(r, source, target);
  console.log(`repo: ${r.name} (project ${r.gitlab.projectId} @ ${r.gitlab.host})`);
  console.log(`방향: ${source} → ${target}`);
  const defBranch = await defaultBranchOf(ws, r);
  console.log(`remove_source_branch(제안): ${defaultRemoveSource(ws, source, defBranch)}${defBranch && defBranch !== ((ws.vars && ws.vars.branch && ws.vars.branch.develop) || 'develop') ? ` · ⚠ 원격 기본 브랜치가 ${defBranch} (통합 브랜치가 아님: kedovi doctor)` : ''}`);
  const ahead = unpushed(r, source);
  if (ahead) console.log(`⚠ 로컬 ${source} 에 push 안 된 커밋 ${ahead}개`);
  console.log(`커밋 ${list.length}개 (머지 제외, 오래된 순):`);
  list.forEach((c) => console.log(`  ${c.sha}\t${c.subject}`));
  if (!list.length) console.log('  (변경 없음: MR 을 만들 필요가 없습니다)');
  const types = [...new Set(list.map((c) => (c.subject.match(/^(\w+):/) || [])[1]).filter(Boolean))];
  console.log(`커밋 type: ${types.join(', ') || '-'}`);
  try {
    const open = await api(ws, r, 'GET', `/merge_requests?state=opened&source_branch=${encodeURIComponent(source)}&target_branch=${encodeURIComponent(target)}`);
    if (open.length) console.log(`⚠ 이미 열린 MR: ${open.map((m) => `!${m.iid} ${m.web_url}`).join(' · ')}`);
    else console.log('열린 MR: 없음');
  } catch (e) { console.log(`열린 MR 확인 불가: ${e.message}`); }
}

async function cmdCreate(ws, a) {
  const r = repoOf(ws, a.repo);
  const source = a.source; const target = a.target || (ws.vars && ws.vars.branch && ws.vars.branch.develop) || 'develop';
  if (!source) die('--source 가 필요합니다');
  if (source === target) die('source 와 target 이 같습니다');
  if (!a.title || a.title === true) die('--title 이 필요합니다');
  if (!a['description-file']) die('--description-file 이 필요합니다');
  const description = fs.readFileSync(a['description-file'], 'utf8');
  const remove = a['remove-source'] === undefined ? defaultRemoveSource(ws, source, a['dry-run'] ? null : await defaultBranchOf(ws, r)) : String(a['remove-source']) === 'true';
  const body = { source_branch: source, target_branch: target, title: a.title, description, remove_source_branch: remove };

  if (a['dry-run']) {
    console.log(`[dry-run] POST ${apiBase(r)}/projects/${r.gitlab.projectId}/merge_requests`);
    console.log('[dry-run] header: PRIVATE-TOKEN: ***');
    if (a.assignee) console.log(`[dry-run] assignee username '${a.assignee}' → id 조회 후 assignee_id 로 넣는다`);
    console.log(JSON.stringify(body, null, 2));
    return;
  }
  if (a.assignee && a.assignee !== true) {
    const t = token(ws, r);
    const res = await fetch(`${apiBase(r)}/users?username=${encodeURIComponent(a.assignee)}`, { headers: { 'PRIVATE-TOKEN': (t && t.value) || '' } });
    const users = res.ok ? await res.json() : [];
    if (!users.length) die(`assignee '${a.assignee}' 를 찾지 못했습니다. 임의 id 로 대체하지 않습니다`);
    body.assignee_id = users[0].id;
  }
  const open = await api(ws, r, 'GET', `/merge_requests?state=opened&source_branch=${encodeURIComponent(source)}&target_branch=${encodeURIComponent(target)}`);
  if (open.length) { console.log(`이미 열린 MR 이 있어 만들지 않았습니다: !${open[0].iid} ${open[0].web_url}`); return; }
  const mr = await api(ws, r, 'POST', '/merge_requests', body);
  console.log(`✔ MR !${mr.iid} ${mr.web_url}`);
  console.log(`  ${source} → ${target} · remove_source_branch=${remove} · assignee=${mr.assignee ? mr.assignee.username : '비움'}`);
}

const MARK = { success: '✔', failed: '✖', running: '▶', canceled: '⊘', canceling: '⊘', skipped: '-', manual: '✋' };
const mark = (st) => MARK[st] || '…';
const two = (n) => String(n).padStart(2, '0');
const when = (iso) => { if (!iso) return '-'; const d = new Date(iso); return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`; };
const took = (sec) => { if (sec == null) return '-'; const s = Math.round(sec); return s < 60 ? `${s}초` : `${Math.floor(s / 60)}분 ${s % 60}초`; };

async function cmdPipeline(ws, a) {
  const r = repoOrOnly(ws, a.repo);
  const limit = Math.max(1, Math.min(50, Number(a.limit) || 5));
  const asked = a.id && a.id !== true ? String(a.id).replace(/^#/, '') : null;
  let list = [];
  let scope = '모든 브랜치';
  if (asked) scope = null;
  else if (a.mr && a.mr !== true) {
    const iid = String(a.mr).replace(/^!/, '');
    list = (await api(ws, r, 'GET', `/merge_requests/${encodeURIComponent(iid)}/pipelines?per_page=${limit}`)).slice(0, limit);
    scope = `MR !${iid}`;
    if (!list.length) {
      // MR 파이프라인을 안 쓰는 프로젝트: 머지했으면 머지 커밋, 아니면 source 브랜치 머리 커밋의 파이프라인
      const mr = await api(ws, r, 'GET', `/merge_requests/${encodeURIComponent(iid)}`);
      const sha = mr.merge_commit_sha || mr.squash_commit_sha || mr.sha;
      if (sha) list = await api(ws, r, 'GET', `/pipelines?per_page=${limit}&order_by=id&sort=desc&sha=${encodeURIComponent(sha)}`);
      scope = `MR !${iid} ${mr.merge_commit_sha || mr.squash_commit_sha ? '머지 커밋' : 'source 커밋'} ${String(sha || '').slice(0, 7)}`;
    }
  } else {
    const ref = a.ref && a.ref !== true ? a.ref : null;
    list = await api(ws, r, 'GET', `/pipelines?per_page=${limit}&order_by=id&sort=desc${ref ? `&ref=${encodeURIComponent(ref)}` : ''}`);
    if (ref) scope = `브랜치 ${ref}`;
  }
  const id = asked || (list[0] && list[0].id);
  let detail = null;
  let jobs = [];
  if (id) {
    detail = await api(ws, r, 'GET', `/pipelines/${encodeURIComponent(id)}`);
    jobs = (await api(ws, r, 'GET', `/pipelines/${encodeURIComponent(id)}/jobs?per_page=100`)).sort((x, y) => x.id - y.id);
  }
  const wantLog = a.log !== undefined;
  const logLines = a.log === true ? 40 : Math.max(1, Math.min(500, Number(a.log) || 40));
  const logs = {};
  if (wantLog) for (const j of jobs.filter((x) => x.status === 'failed')) {
    try { logs[j.id] = String(await api(ws, r, 'GET', `/jobs/${j.id}/trace`)).replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').replace(/\r/g, '').split('\n').filter((l) => l.trim()).slice(-logLines); } catch (e) { logs[j.id] = [`(로그를 읽지 못함: ${e.message})`]; }
  }
  if (a.json) {
    const slim = (p) => ({ id: p.id, status: p.status, ref: p.ref, sha: p.sha, source: p.source, createdAt: p.created_at, url: p.web_url });
    console.log(JSON.stringify({ repo: r.name, pipelines: list.map(slim), detail: detail ? { ...slim(detail), duration: detail.duration, user: detail.user && detail.user.username, jobs: jobs.map((j) => ({ id: j.id, stage: j.stage, name: j.name, status: j.status, duration: j.duration, allowFailure: !!j.allow_failure, url: j.web_url, ...(logs[j.id] ? { log: logs[j.id] } : {}) })) } : null }, null, 2));
    return;
  }
  console.log(`repo: ${r.name} (project ${r.gitlab.projectId} @ ${r.gitlab.host})`);
  if (scope) {
    console.log(`파이프라인 (${scope}, 최근 ${list.length}개):`);
    list.forEach((p) => console.log(`  #${p.id}\t${mark(p.status)} ${p.status}\t${p.ref}\t${String(p.sha || '').slice(0, 7)}\t${when(p.created_at)}\t${p.web_url}`));
    if (!list.length) { console.log('  (없음)'); return; }
  }
  console.log(`\n#${detail.id} ${mark(detail.status)} ${detail.status} · ${detail.ref} · ${String(detail.sha || '').slice(0, 7)} · ${when(detail.created_at)} · ${took(detail.duration)}${detail.user ? ` · ${detail.user.username}` : ''}`);
  if (asked) console.log(`  ${detail.web_url}`);
  const stages = [...new Set(jobs.map((j) => j.stage))];
  for (const st of stages) for (const j of jobs.filter((x) => x.stage === st)) {
    console.log(`  ${st}\t${mark(j.status)} ${j.name}\t${j.status}${j.allow_failure && j.status === 'failed' ? ' (실패 허용)' : ''}\t${took(j.duration)}${j.status === 'failed' ? `\t${j.web_url}` : ''}`);
    if (logs[j.id]) logs[j.id].forEach((l) => console.log(`      | ${l}`));
  }
  if (!jobs.length) console.log('  (작업 없음)');
  const failed = jobs.filter((j) => j.status === 'failed' && !j.allow_failure);
  if (failed.length && !wantLog) console.log(`실패한 작업의 로그 끝부분: --id ${detail.id} --log`);
}

const DONE = new Set(['success', 'failed', 'canceled', 'skipped']);
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
const clock = () => { const d = new Date(); return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`; };

/** 수동 작업 실행(--play) · 다시 실행(--retry): 실행할 수 있을 때까지 기다리고, 실행한 뒤 끝날 때까지 상태를 보인다 */
async function cmdJobRun(ws, a) {
  const r = repoOrOnly(ws, a.repo);
  const act = a.play !== undefined ? 'play' : 'retry';
  const name = a[act];
  if (!name || name === true) die(`--${act} <작업 이름> 이 필요합니다`);
  const id = a.id && a.id !== true ? String(a.id).replace(/^#/, '') : null;
  if (!id) die(`--${act} 는 --id <파이프라인 ID> 와 함께 씁니다 (어느 파이프라인의 작업인지 정확히 정한다)`);
  const poll = Math.max(200, Number(process.env.KEDOVI_POLL_MS) || 5000);
  const until = Date.now() + Math.max(1, Number(a.timeout) || 30) * 60000;
  const detail = await api(ws, r, 'GET', `/pipelines/${encodeURIComponent(id)}`);
  const jobsOf = async () => api(ws, r, 'GET', `/pipelines/${encodeURIComponent(id)}/jobs?per_page=100`);
  const pick = (jobs) => jobs.filter((j) => j.name === name).sort((x, y) => y.id - x.id)[0];
  let jobs = await jobsOf();
  let job = pick(jobs);
  if (!job) die(`파이프라인 #${id} 에 '${name}' 작업이 없습니다. 있는 작업: ${[...new Set(jobs.map((j) => j.name))].join(', ') || '없음'}`);
  console.log(`⚠ 작업 ${act === 'play' ? '실행 (수동 작업)' : '다시 실행'}: ${r.name} · 파이프라인 #${id} (${detail.ref} ${String(detail.sha || '').slice(0, 7)}) · ${job.stage}/${job.name} · 지금 ${job.status}`);
  console.log('  운영 배포 · 데이터를 바꾸는 작업은 사용자 승인을 받은 뒤에만 실행한다.');
  if (!a.yes) { console.log('  실행하지 않았습니다. 사용자 승인을 받았으면 같은 명령에 --yes 를 붙여 다시 실행합니다'); process.exit(3); }

  if (act === 'play') {
    // 앞 작업이 끝나기 전에는 created 다 (그때 play 하면 HTTP 400 Unplayable Job). manual 이 될 때까지 기다린다
    let shown = '';
    while (job.status === 'created' || job.status === 'waiting_for_resource' || job.status === 'preparing') {
      const ahead = jobs.filter((j) => j.id !== job.id && ['running', 'pending', 'created', 'waiting_for_resource', 'preparing'].includes(j.status) && j.stage !== job.stage).map((j) => `${j.name} ${j.status}`);
      const line = `앞 작업을 기다림 (${job.status})${ahead.length ? `: ${ahead.slice(0, 4).join(' · ')}` : ''}`;
      if (line !== shown) { console.log(`  ${clock()} ${line}`); shown = line; }
      if (Date.now() > until) { console.log(`✖ 시간이 지나 멈춥니다 (지금 ${job.status}). 다시 보기: kedovi gitlab pipeline --id ${id}`); process.exit(4); }
      await sleep(poll);
      jobs = await jobsOf();
      job = pick(jobs) || job;
    }
    if (job.status === 'skipped' || job.status === 'canceled') die(`${name} 이(가) ${job.status} 입니다. 앞 작업이 실패 · 취소돼 실행할 수 없습니다 (kedovi gitlab pipeline --id ${id} --log)`);
    if (job.status === 'manual') {
      job = await api(ws, r, 'POST', `/jobs/${job.id}/play`);
      console.log(`  ${clock()} ▶ 실행 요청 (작업 ${job.id})`);
    } else if (DONE.has(job.status)) die(`${name} 은(는) 이미 ${job.status} 입니다${job.status === 'success' ? '' : `. 다시 실행: --retry ${name} --yes`}`);
    else console.log(`  ${clock()} 이미 시작됨 (${job.status}). 끝날 때까지 봅니다`);
  } else {
    if (job.status === 'manual') die(`${name} 은(는) 아직 실행하지 않은 수동 작업입니다. --play ${name} --yes`);
    if (!DONE.has(job.status) || job.status === 'skipped') die(`${name} 은(는) ${job.status} 라 다시 실행할 수 없습니다 (끝난 작업만: failed · canceled · success)`);
    job = await api(ws, r, 'POST', `/jobs/${job.id}/retry`);
    console.log(`  ${clock()} ▶ 다시 실행 요청 (새 작업 ${job.id})`);
  }

  // 끝날 때까지 상태가 바뀔 때마다 한 줄
  let last = job.status;
  console.log(`  ${clock()} ${mark(last)} ${last}`);
  while (!DONE.has(job.status) && job.status !== 'manual') {
    if (Date.now() > until) { console.log(`✖ 시간이 지나 멈춥니다 (지금 ${job.status}, 작업은 계속 돈다). 다시 보기: kedovi gitlab pipeline --id ${id}`); process.exit(4); }
    await sleep(poll);
    job = await api(ws, r, 'GET', `/jobs/${job.id}`);
    if (job.status !== last) { last = job.status; console.log(`  ${clock()} ${mark(last)} ${last}`); }
  }
  if (job.status === 'success') { console.log(`✔ ${name} 성공 (${took(job.duration)}) ${job.web_url || ''}`.trim()); return; }
  console.log(`✖ ${name} ${job.status} ${job.web_url || ''}`.trim());
  console.log(`  로그 끝부분: kedovi gitlab pipeline --id ${id} --log${job.status === 'failed' ? ` · 다시 실행: --id ${id} --retry ${name} --yes` : ''}`);
  process.exit(1);
}

function cmdRepos(ws) {
  const list = ws.repos.filter((r) => r.gitlab);
  if (!list.length) { console.log('gitlab 설정이 있는 repo 가 없습니다. workspace.json repos[].gitlab = {host, projectId}'); return; }
  list.forEach((r) => console.log(`${r.name}\t${r.gitlab.host}\tproject ${r.gitlab.projectId}`));
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const cmd = a._[0];
  if (!['preview', 'create', 'pipeline', 'repos'].includes(cmd)) {
    console.log(fs.readFileSync(__filename, 'utf8').split("\n").slice(5, 22).map((l) => l.replace(/^ \* ?/, '')).join('\n'));
    process.exit(cmd ? 1 : 0);
  }
  const ws = loadWs();
  if (cmd === 'repos') return cmdRepos(ws);
  if (cmd === 'pipeline') return a.play !== undefined || a.retry !== undefined ? cmdJobRun(ws, a) : cmdPipeline(ws, a);
  if (cmd === 'preview') return cmdPreview(ws, a);
  return cmdCreate(ws, a);
}

if (require.main === module) main().catch((e) => die(e.message));

module.exports = { loadWs, parseArgs, die, token, api, apiBase, repoOf, repoOrOnly, defaultRemoveSource };
