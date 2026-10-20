// Spring 레포의 Java 소스 루트를 찾는 공용 헬퍼 (stack-spring 도구 공통). 사용: const src = require('./lib/spring-src').resolve(process.argv)
'use strict';
const fs = require('fs');
const path = require('path');

/**
 * 우선순위
 *   1. `--root <dir>`  — dir 아래 src/main/java 가 있으면 그것, 없으면 dir 자체를 Java 소스 루트로 본다
 *   2. workspace.json  — vars.spring.repo(레포 이름) → 없으면 stack 에 "spring" 이 들어간 첫 레포
 * base = javaRoot/<vars.spring.basePackage 경로> (없으면 javaRoot)
 * 반환: { javaRoot, base, repo, via } 또는 { error }
 */
function resolve(argv = process.argv) {
  const i = argv.indexOf('--root');
  if (i !== -1) {
    const dir = argv[i + 1];
    if (!dir || dir.startsWith('--')) return { error: '--root 뒤에 경로가 필요합니다' };
    const abs = path.resolve(dir);
    if (!fs.existsSync(abs)) return { error: `--root 경로가 없습니다: ${abs}` };
    const javaRoot = fs.existsSync(path.join(abs, 'src', 'main', 'java')) ? path.join(abs, 'src', 'main', 'java') : abs;
    return { javaRoot, base: withBase(javaRoot, null), repo: null, via: '--root' };
  }

  let ws;
  try {
    ws = require(path.join(__dirname, '..', '..', '..', 'core', 'lib', 'workspace.js')).load();
  } catch (e) {
    return { error: `workspace.json 을 읽지 못했습니다 (${e.message}). --root <Java 소스 경로> 로 지정하세요` };
  }
  const spring = (ws.vars && ws.vars.spring) || {};
  const repo = spring.repo
    ? ws.repos.find((r) => r.name === spring.repo)
    : ws.repos.find((r) => /spring/i.test(String(r.stack || '')));
  if (!repo) {
    return { error: spring.repo ? `workspace.json repos 에 '${spring.repo}' 가 없습니다 (vars.spring.repo)` : 'workspace.json repos 에 stack 이 spring 인 레포가 없습니다. vars.spring.repo 로 지정하세요' };
  }
  const javaRoot = path.join(repo.dir, 'src', 'main', 'java');
  if (!fs.existsSync(javaRoot)) return { error: `${repo.name}: ${javaRoot} 가 없습니다 (없으면 aikit install)`, missing: true };
  return { javaRoot, base: withBase(javaRoot, spring.basePackage), repo: repo.name, via: 'workspace.json', ws };
}

function withBase(javaRoot, basePackage) {
  if (!basePackage) return javaRoot;
  const p = path.join(javaRoot, ...String(basePackage).split('.'));
  return fs.existsSync(p) ? p : javaRoot;
}

function javaFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) javaFiles(p, out);
    else if (e.name.endsWith('.java')) out.push(p);
  }
  return out;
}

module.exports = { resolve, javaFiles };
