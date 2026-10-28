#!/usr/bin/env node
// repo 커밋 검사 (repos/* 의 pre-commit 이 부른다): 이 PC 사용자가 그 repo 담당이 아니면 커밋을 막는다.
// 담당 = workspace.json team.members[].repos, 팀장(team.leads) · 담당 없는 repo 는 통과. 판정은 packs/core/lib/team.js
// 사용: node packs/core/bin/repo-check.js <repo 폴더>
'use strict';
const fs = require('fs');
const path = require('path');

function wsRoot(dir) {
  // 개발 repo 는 워크스페이스의 repos/ 아래에 있다. 링크로 빌려 온 repo 는 이 스크립트가 있는 워크스페이스를 쓴다
  const own = path.resolve(__dirname, '..', '..', '..');
  if (fs.existsSync(path.join(own, 'workspace.json'))) return own;
  for (let d = path.resolve(dir); d !== path.dirname(d); d = path.dirname(d)) if (fs.existsSync(path.join(d, 'workspace.json'))) return d;
  return null;
}

function main() {
  const repoDir = process.argv[2] || process.cwd();
  const root = wsRoot(repoDir);
  if (!root) return 0;
  const team = require('../lib/team');
  const { load } = require('../lib/workspace');
  const ws = load(root);
  if (!ws.team) return 0;
  const repo = team.repoOfPath(root, ws, repoDir);
  if (!repo) return 0;
  const acc = team.repoAccess(root, ws, repo);
  if (acc.ok) return 0;
  console.error(`✖ ${team.blockMessage(repo, acc)}`);
  console.error('  담당은 workspace.json team.members[].repos (팀장이 정한다). 이 PC 사용자 확인: kedovi team whoami');
  return 1;
}

let code = 0;
try { code = main(); } catch { code = 0; } // 검사 자체가 깨지면 커밋을 막지 않는다 (막는 것은 판정이 끝났을 때만)
process.exit(code);
