#!/usr/bin/env node
// SessionStart 훅 — 상시 컨텍스트가 실제와 어긋났는지 본다 (죽은 참조 · kit 생성물 드리프트 · 루트 잔여물). 정상이면 1줄. 항상 exit 0
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { run, context, readInput, markSessionStart } = require('../lib/hook');
const { root, git } = require('../lib/workspace');
const { findDeadRefs } = require('../bin/check-refs');

const STRAY_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.json', '.har', '.log', '.zip']);
const KNOWN_ROOT = new Set(['workspace.json', 'package.json', 'package-lock.json', 'tsconfig.json', 'jsconfig.json']);

run(() => {
  try { markSessionStart(readInput()); } catch { /* 세션 표식은 부가 기능 */ }
  const ROOT = root();
  const findings = [];
  const notes = [];

  // 1. 죽은 참조
  try {
    const dead = findDeadRefs(ROOT);
    for (const d of dead.slice(0, 15)) findings.push(['죽은 참조', `${d.file}:${d.line} → \`${d.ref}\``]);
    if (dead.length > 15) findings.push(['죽은 참조', `… 외 ${dead.length - 15}건 (\`node packs/core/bin/check-refs.js\`)`]);
  } catch (e) { notes.push(`죽은 참조 검사 실패: ${e.message}`); }

  // 2. kit 생성물 드리프트
  const kit = path.join(ROOT, 'bin', 'kit.js');
  if (fs.existsSync(kit)) {
    const r = spawnSync('node', [kit, 'check'], { cwd: ROOT, encoding: 'utf8', timeout: 20000 });
    if (r.status !== 0) {
      const lines = `${r.stderr || ''}${r.stdout || ''}`.split('\n').filter((l) => l.startsWith('✖'));
      findings.push(['kit 드리프트', `${lines[0] || 'kit check 실패'}${lines.length > 1 ? ` 외 ${lines.length - 1}줄` : ''}: 정본(packs/·workspace.json)을 고치고 \`node bin/kit.js sync\``]);
    }
  }

  // 3. 루트 잔여물 — 추적되지 않는 캡처·덤프 파일이 루트에 쌓이는 것
  try {
    const tracked = new Set((git(ROOT, ['ls-files']) || '').split('\n').filter((l) => l && !l.includes('/')));
    const stray = fs.readdirSync(ROOT, { withFileTypes: true })
      .filter((d) => d.isFile() && !d.name.startsWith('.') && STRAY_EXT.has(path.extname(d.name).toLowerCase()))
      .filter((d) => !tracked.has(d.name) && !KNOWN_ROOT.has(d.name))
      .map((d) => d.name);
    if (stray.length) findings.push(['루트 잔여물', `추적 안 되는 파일 ${stray.length}개 (${stray.slice(0, 3).join(', ')}${stray.length > 3 ? ' 외' : ''}). 버릴 캡처는 임시 폴더로, 남길 것은 문서 폴더로 옮기고 루트 것은 지운다`]);
  } catch (e) { notes.push(`루트 잔여물 검사 실패: ${e.message}`); }

  if (!findings.length) {
    context(`✓ 컨텍스트 싱크 정상${notes.length ? ` (skip: ${notes.join(' / ')})` : ''}`);
    return;
  }
  const out = [`## ⚠️ 컨텍스트 싱크 드리프트 ${findings.length}건`, '', '| 검사 | 내용 |', '|---|---|',
    ...findings.map(([k, v]) => `| ${k} | ${v.replace(/\|/g, '\\|')} |`), '',
    '> 상시 컨텍스트가 실제와 어긋난 상태다. 사용자의 첫 요청을 받기 전에 이 항목부터 정리를 제안한다.'];
  if (notes.length) out.push(`> skip: ${notes.join(' / ')}`);
  context(out.join('\n'));
});
