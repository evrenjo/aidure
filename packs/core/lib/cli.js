'use strict';
// 에이전트 CLI(claude·codex) 실행 파일 찾기 — PATH 에 없으면 Codex 앱이 내려받은 CLI 도 본다.
// Codex 앱은 $CODEX_HOME(기본 ~/.codex)/packages/<이름>/current → 최신 releases/<버전> 링크를 두고,
// 그 안 codex-package.json 의 entrypoint(bin/codex)가 CLI 다. 버전 폴더를 직접 고르지 않아 앱이 업데이트해도 안 끊긴다.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

function onPath(cmd) {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.split(/\r?\n/)[0].trim() || null : null;
}

function codexAppCli(env = process.env) {
  const pkgs = path.join(env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'packages');
  let names = [];
  try { names = fs.readdirSync(pkgs).sort(); } catch { return null; }
  for (const n of names) {
    const cur = path.join(pkgs, n, 'current');
    let entry = 'bin/codex';
    try { entry = JSON.parse(fs.readFileSync(path.join(cur, 'codex-package.json'), 'utf8')).entrypoint || entry; } catch { /* 기본 위치로 */ }
    for (const f of process.platform === 'win32' ? [`${entry}.exe`, entry] : [entry]) {
      const p = path.join(cur, f);
      try { if (fs.statSync(p).isFile()) return p; } catch { /* 다음 */ }
    }
  }
  return null;
}

/** 실행 파일 경로, 없으면 null */
function findCli(cmd, env = process.env) {
  return onPath(cmd) || (cmd === 'codex' ? codexAppCli(env) : null);
}

module.exports = { findCli, codexAppCli };
