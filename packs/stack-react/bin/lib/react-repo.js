// stack-react 도구 공용 — workspace.json 에서 프론트 repo 경로와 vars.react 설정을 읽는다. 사용: require('./lib/react-repo').resolve(argv)
'use strict';
const fs = require('fs');
const path = require('path');
const { load } = require('../../../core/lib/workspace');

const DEFAULTS = {
  srcDir: 'src',
  viewsDir: 'src/views',
  aliases: { '@/': 'src/' },
};

/** 현재 폴더에서 위로 workspace.json 을 찾는다 (core 의 git 폴백이 워크스페이스 밖에서 stderr 를 남기지 않게). */
function findRoot() {
  let d = process.cwd();
  for (;;) {
    if (fs.existsSync(path.join(d, 'workspace.json'))) return d;
    const up = path.dirname(d);
    if (up === d) return null;
    d = up;
  }
}

/** `--repo <경로>` 가 있으면 그것, 없으면 vars.react.repo, 없으면 stack 에 react 가 들어간 첫 repo. */
function resolve(argv = process.argv.slice(2)) {
  let ws = null;
  const found = findRoot();
  if (found) try { ws = load(found); } catch { /* 깨진 workspace.json — --repo 로만 쓸 수 있다 */ }
  const cfg = { ...DEFAULTS, ...((ws && ws.vars && ws.vars.react) || {}) };
  const i = argv.indexOf('--repo');
  if (i >= 0 && argv[i + 1]) {
    const dir = path.resolve(argv[i + 1]);
    if (!fs.existsSync(dir)) return { ws, cfg, dir: null, name: null, why: `--repo 경로가 없습니다 (${dir})` };
    return { ws, cfg, dir, name: path.basename(dir) };
  }
  if (!ws) return { ws, cfg, dir: null, name: null, why: 'workspace.json 을 찾지 못했습니다 (--repo <경로> 로 지정)' };

  const repos = ws.repos || [];
  const pick = cfg.repo
    ? repos.find((r) => r.name === cfg.repo)
    : repos.find((r) => /react/i.test(String(r.stack || '')));
  if (!pick) {
    return { ws, cfg, dir: null, name: null, why: cfg.repo
      ? `vars.react.repo '${cfg.repo}' 가 workspace.json repos 에 없습니다`
      : 'stack 에 react 가 들어간 repo 가 workspace.json repos 에 없습니다 (vars.react.repo 로 지정)' };
  }
  // repos/<이름> · repos/<그룹>/<이름>(aidure install)이 있으면 그것, 없으면 repos[].path 를 워크스페이스 기준으로
  const linked = pick.dir && fs.existsSync(pick.dir) ? pick.dir : null;
  const dir = linked || (pick.path ? path.resolve(ws.root, pick.path) : null);
  if (!dir || !fs.existsSync(dir)) return { ws, cfg, dir: null, name: pick.name, why: `${pick.name} 경로가 없습니다 (${dir || '경로 미지정'})` };
  return { ws, cfg, dir, name: pick.name };
}

module.exports = { resolve };
