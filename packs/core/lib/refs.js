// 참고 자료(기획 · 레거시 · 이슈 repo)가 실제로 읽을 내용이 있는지 — 표의 경로는 "위치" 일 뿐이라 비어 있을 수 있다. 훅 · 브리핑이 쓴다. 의존성 없음
'use strict';
const fs = require('fs');
const path = require('path');

const SKIP_DIR = new Set(['.git', 'node_modules', 'target', 'build', 'dist', '.idea', '.vscode', '__pycache__']);
const SKELETON = /^(readme(\.[a-z]+)?|license(\.[a-z]+)?|changelog(\.[a-z]+)?|\.gitignore|\.gitattributes|\.gitkeep|\.ds_store)$/i;

/** dir 아래 파일 수 (뼈대 파일 제외, pred 로 거름). cap 에서 멈춘다 */
function countFiles(dir, pred = () => true, cap = 2000) {
  let n = 0;
  const walk = (d) => {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (n >= cap) return;
      if (e.isDirectory()) { if (!SKIP_DIR.has(e.name)) walk(path.join(d, e.name)); continue; }
      if (SKELETON.test(e.name)) continue;
      if (pred(e.name)) n++;
    }
  };
  walk(dir);
  return n;
}

/**
 * 참고 자료 repo 마다 { name, kind, readDir, state, count }.
 * state: missing(받지 않음) · no-path(읽을 폴더 없음) · empty(뼈대 파일만) · ok
 */
function referenceStatus(ws) {
  const root = ws.root;
  return (ws.repos || []).filter((r) => ['docs', 'legacy', 'issues'].includes(r.kind)).map((r) => {
    const dir = path.isAbsolute(r.dir || '') ? r.dir : path.join(root, r.dir || path.join('repos', r.name));
    const sub = r.kind === 'docs' ? (r.mdPath || '') : r.kind === 'legacy' ? (r.sourceRoot || '') : '';
    const readDir = path.join(dir, sub);
    const rel = path.relative(root, readDir).split(path.sep).join('/');
    if (!fs.existsSync(dir)) return { name: r.name, kind: r.kind, readDir: rel, state: 'missing', count: 0 };
    if (!fs.existsSync(readDir)) return { name: r.name, kind: r.kind, readDir: rel, state: 'no-path', count: 0 };
    const pred = r.kind === 'legacy' ? () => true : (f) => /\.(md|markdown|txt)$/i.test(f);
    const count = countFiles(readDir, pred);
    return { name: r.name, kind: r.kind, readDir: rel, state: count ? 'ok' : 'empty', count };
  });
}

const KIND = { docs: '기획', legacy: '레거시', issues: '이슈' };

/** 한 항목을 짧은 한국어로 */
function describe(s) {
  if (s.state === 'missing') return `${s.name}: 받지 않음 (aidure install)`;
  if (s.state === 'no-path') return `${s.name}: ${s.readDir}/ 폴더 없음`;
  if (s.state === 'empty') return `${s.name}: 비어 있음 (${s.readDir}/ 에 README 만)`;
  return `${s.name}: ${s.kind === 'legacy' ? '파일' : 'md'} ${s.count}${s.count >= 2000 ? '+' : ''}개`;
}

module.exports = { referenceStatus, describe, countFiles, KIND };
