'use strict';
// 팀장 · 팀원 · repo 담당 판정 (bin/kit.js · 훅 · repo 커밋 검사가 함께 쓴다. Node 기본 모듈만)
//
// workspace.json team:
//   leads   : [{ username, nickname }]               팀장. 모든 repo · 워크스페이스 설정을 고친다 (옛 admins 문자열도 팀장으로 읽는다)
//   members : [{ username, nickname, repos: [...] }]  팀원. repos 에 적힌 repo 만 고친다 (옛 문자열 = 명단만)
// 담당이 한 명도 없는 repo 는 누구나 고친다. 이 PC 의 나는 .agents/local.json me.username (kedovi install · start 가 저장소 계정으로 채운다), 없으면 git user.name
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const LOCAL = path.join('.agents', 'local.json');

/** 사람 항목 → { username, nickname, repos } (문자열이면 username 만) */
function person(x) {
  // 문자열(옛 형식)과 source: "git" 항목은 username 자리에 git user.name 이 들어 있다 (kedovi init 이 저장소 계정을 못 읽었을 때)
  if (typeof x === 'string') return { username: x.trim(), nickname: '', repos: null, byGit: true };
  const o = x && typeof x === 'object' ? x : {};
  return { username: String(o.username || '').trim(), nickname: String(o.nickname || '').trim(), repos: Array.isArray(o.repos) ? o.repos.map(String) : null, byGit: o.source === 'git' };
}

/** 부를 이름 */
const callName = (p) => (p && (p.nickname || p.username)) || '';

/** 팀 구성 → { leads, members } (중복 username 은 앞의 것) */
function roster(ws) {
  const t = (ws && ws.team) || {};
  // 팀장 · 팀원은 따로 거른다 (팀장이 팀원 담당에도 적혀 있으면 그 repo 담당으로 남아야 한다)
  const uniq = (list) => { const seen = new Set(); return list.map(person).filter((p) => p.username && !seen.has(p.username) && seen.add(p.username)); };
  const leads = uniq([...(t.leads || []), ...(t.admins || [])]);
  const members = uniq(t.members || []);
  return { leads, members };
}

/** 이 PC 의 나 — { username, gitName, source } */
function me(root) {
  let local = {};
  try { local = JSON.parse(fs.readFileSync(path.join(root, LOCAL), 'utf8')).me || {}; } catch { /* 없음 */ }
  let gitName = '';
  try { gitName = execFileSync('git', ['-C', root, 'config', 'user.name'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { /* 없음 */ }
  const username = String(local.username || '').trim();
  // 저장소 계정을 확인했으면(ssh · gh · glab · git credential · 직접 입력) git user.name 으로는 맞추지 않는다 (이름만 바꿔 다른 사람이 되는 것을 막는다)
  return { username: username || gitName, gitName, source: username ? (local.source || 'account') : 'git user.name', account: !!username };
}

/** 나를 팀 구성에서 찾는다 — 저장소 계정 username, 옛 방식(git user.name)도 맞춘다 */
function whoAmI(root, ws) {
  const m = me(root);
  const { leads, members } = roster(ws);
  // 저장소 계정을 확인한 PC 는 계정으로만 맞춘다. 단 git user.name 으로 적힌 항목(옛 형식 · source git)은 git user.name 으로도 (팀장이 계정으로 바꿀 때까지)
  const match = (p) => p.username === m.username || (m.gitName && p.username === m.gitName && (!m.account || p.byGit));
  const lead = leads.find(match);
  const member = members.find(match);
  const self = lead || member || null;
  return { ...m, lead: !!lead, person: self, nickname: self ? self.nickname : '', repos: member && member.repos ? member.repos : null };
}

/** repo 담당자 목록 (members[].repos 에 이름이 있는 사람) */
const ownersOf = (ws, repo) => roster(ws).members.filter((p) => (p.repos || []).includes(repo));

/** 이 repo 를 고칠 수 있나 — { ok, owners, leads, who } */
function repoAccess(root, ws, repo, who = whoAmI(root, ws)) {
  const owners = ownersOf(ws, repo);
  const { leads } = roster(ws);
  const ok = who.lead || !owners.length || owners.some((p) => p.username === who.username || (who.gitName && p.username === who.gitName && (!who.account || p.byGit)));
  return { ok, owners, leads, who };
}

/** 막힌 repo 이름 목록 */
function blockedRepos(root, ws, who = whoAmI(root, ws)) {
  if (who.lead) return [];
  return ((ws && ws.repos) || []).map((r) => r.name).filter((n) => !repoAccess(root, ws, n, who).ok);
}

/** 막을 때 안내 — 담당자 · 팀장 이름으로 */
function blockMessage(repo, acc) {
  const names = (list) => list.map(callName).filter(Boolean).join(' · ');
  const lead = names(acc.leads);
  return `repos/${repo} 는 ${names(acc.owners)}님 담당이라 ${callName(acc.who.person) || acc.who.username || '이 PC 사용자'}님은 고칠 수 없습니다. `
    + `고칠 일이 있으면 담당자에게 요청하거나${lead ? ` 팀장(${lead})님에게 말해 담당을 받으세요` : ' 팀장에게 말해 담당을 받으세요'} (읽기는 자유)`;
}

/** 경로가 어느 repo 안인지 — repos 의 dir(상대) 기준. 반환 repo 이름 또는 null */
function repoOfPath(root, ws, file) {
  if (!file) return null;
  // 링크로 들어온 repo(로컬 폴더)는 실제 경로로도 온다 — 양쪽을 실제 경로로 맞춘다. 아직 없는 파일은 있는 상위 폴더까지 풀고 나머지를 붙인다
  const real = (p) => { try { return fs.realpathSync(p); } catch { const d = path.dirname(p); return d === p ? p : path.join(real(d), path.basename(p)); } };
  const abs = path.resolve(root, file);
  const cands = [abs, real(abs)];
  let best = null;
  for (const r of (ws && ws.repos) || []) {
    const raw = path.resolve(root, r.dir || path.join('repos', r.group ? `${r.group}/${r.name}` : r.name));
    for (const dir of new Set([raw, real(raw)])) {
      if (cands.some((a) => a === dir || a.startsWith(dir + path.sep)) && (!best || dir.length > best.len)) best = { name: r.name, len: dir.length };
    }
  }
  return best ? best.name : null;
}

module.exports = { person, callName, roster, me, whoAmI, ownersOf, repoAccess, blockedRepos, blockMessage, repoOfPath, LOCAL };
