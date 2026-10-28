#!/usr/bin/env node
// 정리 후보 찾기 (읽기만): 방향이 바뀌거나 고친 뒤 남은 파일을 repo 별로 모은다. 지우는 것은 tidy 스킬이 사용자 승인 뒤에 한다.
/*
 * 실행: node packs/core/bin/tidy.js [--repo <이름>[,<이름>]] [--new] [--count] [--json]
 *
 * 보는 것 (코드 · 이슈 · 기획 repo + 워크스페이스. 레거시는 읽기 전용이라 뺀다)
 *   새 파일     이번 작업에서 만든 파일: 커밋 안 한 새 파일 + push 안 한 커밋에서 더한 파일. 옛 방향의 산출물이 여기 섞여 있다
 *   안 쓰는 자료 이미지 · 동영상 · PDF · 디자인 파일 중 repo 의 어느 글(코드 · 문서 · 설정)에도 이름이 나오지 않는 것
 *   링크 없는 문서 md 중 다른 파일이 이름으로 가리키지 않는 것 (기획 repo 는 사이트 메뉴가 모두 보여 주므로 뺀다)
 *   백업 이름    _old · .bak · .orig · 복사본 · (1) · _final · -v2 처럼 옛 판을 남긴 이름
 *   코드         언어마다 달라 직접 찾지 않는다. repo 에 있는 도구(knip · ts-prune · vulture · detekt · Android lint)를 알려 준다
 *
 * --new    새 파일만 (이번 작업 범위) · 나머지 항목도 새 파일 안에서만 본다
 * --count  한 줄 요약 (핸드오프 · 단계 완료 보고용). 후보가 없으면 「정리 후보 없음」
 * --json   전체 결과
 * 이름 검사는 파일 이름에서 확장자를 뺀 이름(3자 이상)으로 한다: Android R.drawable.x · 확장자 없이 쓰는 경로도 쓰는 것으로 본다 (놓치는 쪽보다 덜 잡는 쪽)
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const W = require('../lib/workspace');

const ASSET = /\.(png|jpe?g|gif|webp|avif|bmp|svg|ico|tiff?|heic|mp4|webm|mov|avi|mp3|wav|pdf|psd|ai|sketch|fig|xd|drawio|excalidraw)$/i;
// 옛 판을 남긴 이름. 백업 확장자는 그대로, 이름 표시(_old · copy · -v2 · (1) 등)는 같은 폴더에 표시를 뺀 원본 이름이 있을 때만 (deep-copy.ts · api_v2.ts 같은 정상 파일을 잡지 않게)
const BACKUP_EXT = /\.(bak|orig|old|swp)$|~$|\.[^./]+\.(bak|orig|old)$/i;
const MARK = '(?:old|bak|backup|orig|copy|사본|백업|복사본|최종|final|v\\d+)';
const SUFFIXED = new RegExp(`^(.+?)(?:[._ -]${MARK}\\d*| ?\\(\\d+\\))(\\.[^./]+)?$`, 'i');
const PREFIXED = new RegExp(`^(?:copy of|${MARK})[ _-](.+)$`, 'i');
// 코드 파일의 판 번호(api_v2.ts)는 정상 이름이라 보지 않는다
const CODE_EXT = /\.(js|jsx|mjs|cjs|ts|tsx|py|java|kt|kts|swift|dart|go|rs|c|h|cc|cpp|hpp|cs|rb|php|scala|vue|svelte|sql|proto|graphql)$/i;
const VERSION_MARK = /[._ -]v\d+(\.[^./]+)?$/i;
const DOC = /\.md$/i;
const KEEP_DOC = /^(README|CHANGELOG|LICENSE|CONTRIBUTING|CODE_OF_CONDUCT|SECURITY|SUPPORT|AGENTS|AGENTS\.override|CLAUDE|CLAUDE\.local|GEMINI|copilot-instructions|index|SKILL)\.md$/i;
// 도구가 이름 · 위치로 읽는 md (지침 · 템플릿 · 변경 기록 조각): 점(.)으로 시작하는 폴더 안은 문서 후보에서 뺀다
const TOOL_DOC_DIR = /(^|\/)\.[^/]+\//;
// 도구 · 플랫폼이 이름으로 찾는 파일 (글에 이름이 안 나와도 쓰인다)
const PLATFORM_ASSET = /(^|\/)(favicon[^/]*|apple-touch-icon[^/]*|mstile[^/]*|og-image[^/]*|android-chrome[^/]*|safari-pinned-tab[^/]*)$|(^|\/)(mipmap-[^/]+|drawable[^/]*|res\/raw|Assets\.xcassets|\.github|fastlane|metadata)\//i;
// 워크스페이스 자신에서 보지 않는 곳: 킷 생성물 · 기록
const WS_SKIP = /^(packs|bin|\.agents|\.claude|\.codex|\.githooks|handoffs|docs-site|repos)\//;
const SKIP_PATH = /(^|\/)(node_modules|vendor|dist|build|out|target|\.gradle|\.venv|venv|__pycache__|Pods|\.dart_tool|coverage)\//;
const MAX = 30;

const args = process.argv.slice(2);
const has = (k) => args.includes(`--${k}`);
const val = (k) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };

function gitOut(dir, a) {
  try { return execFileSync('git', ['-C', dir, '-c', 'core.quotePath=false', ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 128 * 1024 * 1024 }); } catch { return null; }
}

/** 이 repo 의 파일 (추적 + 무시 안 된 새 파일) */
function listFiles(dir) {
  const out = gitOut(dir, ['ls-files', '-z', '--cached', '--others', '--exclude-standard']);
  return out === null ? null : [...new Set(out.split('\0').filter(Boolean))].filter((f) => fs.existsSync(path.join(dir, f)));
}

/** 이번 작업에서 만든 파일: 커밋 안 한 새 파일 + 어느 원격에도 없는 커밋이 더한 파일 (원격이 없으면 커밋 안 한 것만) */
function newFiles(dir) {
  const set = new Set();
  const st = (gitOut(dir, ['status', '--porcelain', '-z', '-uall', '--', '.']) || '').split('\0');
  for (let i = 0; i < st.length; i++) {
    const e = st[i];
    if (!e) continue;
    const xy = e.slice(0, 2);
    if (/[RC]/.test(xy)) i++;
    if (xy === '??' || /A/.test(xy)) set.add(e.slice(3));
  }
  const remote = (gitOut(dir, ['for-each-ref', '--count=1', '--format=%(refname)', 'refs/remotes']) || '').trim();
  const head = gitOut(dir, ['rev-parse', '--verify', '-q', 'HEAD']);
  if (remote && head) for (const f of (gitOut(dir, ['log', '--name-only', '--diff-filter=A', '--format=', '-z', 'HEAD', '--not', '--remotes', '--', '.']) || '').split('\0')) if (f.trim()) set.add(f.trim());
  return [...set].filter((f) => fs.existsSync(path.join(dir, f)) && !fs.statSync(path.join(dir, f)).isDirectory());
}

const stem = (f) => path.basename(f).replace(/\.[^.]+$/, '');

// 이름 찾기에서 뺄 큰 생성물 (번들 · 소스맵 · 잠금 · 로그): 느리고, 쓰는 근거도 아니다
const GREP_EXCLUDE = ['*.min.js', '*.min.css', '*.map', '*.lock', 'package-lock.json', 'pnpm-lock.yaml', '*.log', '*.snap'].map((g) => `:(exclude,glob)**/${g}`);

/** 이름 → 그 이름이 나오는 파일 목록. git grep 이 실패하면 null (후보를 내지 않는다) */
function referenced(dir, names) {
  const found = new Map();
  if (!names.length) return found;
  const tmp = path.join(os.tmpdir(), `aidure-tidy-${process.pid}-${Date.now()}.txt`);
  fs.writeFileSync(tmp, names.join('\n') + '\n');
  try {
    const r = spawnSync('git', ['-C', dir, '-c', 'core.quotePath=false', 'grep', '--untracked', '-I', '-o', '-F', '-z', '-f', tmp, '--', '.', ...GREP_EXCLUDE], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 120000 });
    if (r.error || (r.status !== 0 && r.status !== 1)) return null; // 1 = 하나도 없음
    // -z: 줄마다 "<파일>\0<찾은 이름>"
    for (const line of (r.stdout || '').split('\n')) {
      const z = line.indexOf('\0');
      if (z < 0) continue;
      const hit = line.slice(z + 1);
      if (!found.has(hit)) found.set(hit, new Set());
      found.get(hit).add(line.slice(0, z));
    }
  } finally { try { fs.unlinkSync(tmp); } catch { /* 이미 없음 */ } }
  return found;
}
/** 다른 파일이 이 파일 이름을 쓰나 (그 파일 자신 안에 나온 것은 세지 않는다. 이름이 같은 다른 파일 안은 센다: architecture.md 속 architecture.png) */
const usedBy = (found, f) => [...(found.get(stem(f)) || [])].some((x) => x !== f);

function codeTools(dir) {
  const tools = [];
  const read = (f) => { try { return fs.readFileSync(path.join(dir, f), 'utf8'); } catch { return ''; } };
  const pkg = read('package.json');
  if (/"knip"/.test(pkg)) tools.push('npx knip');
  if (/"ts-prune"/.test(pkg)) tools.push('npx ts-prune');
  if (/"depcheck"/.test(pkg)) tools.push('npx depcheck');
  if (/vulture/.test(read('pyproject.toml') + read('requirements-dev.txt') + read('requirements.txt') + read('setup.cfg'))) tools.push('vulture .');
  const gradle = read('build.gradle') + read('build.gradle.kts') + read('app/build.gradle') + read('app/build.gradle.kts');
  if (/detekt/.test(gradle)) tools.push('./gradlew detekt');
  if (/com\.android\.(application|library)/.test(gradle)) tools.push('./gradlew lint (UnusedResources)');
  if (/\bdart_code_metrics|dcm\b/.test(read('pubspec.yaml') + read('analysis_options.yaml'))) tools.push('dcm check-unused-code lib');
  return tools;
}

function scanRepo(r, onlyNew) {
  const res = { name: r.name, kind: r.kind, self: !!r.self, newFiles: [], assets: [], docs: [], backups: [], codeTools: [], error: null };
  const files = listFiles(r.dir);
  if (!files) { res.error = 'git 으로 읽지 못함'; return res; }
  const skip = (f) => SKIP_PATH.test(f) || (r.self && WS_SKIP.test(f));
  const fresh = newFiles(r.dir).filter((f) => !skip(f));
  res.newFiles = fresh;
  const pool = (onlyNew ? fresh : files).filter((f) => !skip(f));
  const assets = pool.filter((f) => ASSET.test(f) && !PLATFORM_ASSET.test(f) && stem(f).length >= 3);
  const docs = r.kind === 'docs' ? [] : pool.filter((f) => DOC.test(f) && !KEEP_DOC.test(path.basename(f)) && !TOOL_DOC_DIR.test(f) && !/(^|\/)_[^/]*$/.test(f) && stem(f).length >= 3);
  const used = referenced(r.dir, [...new Set([...assets, ...docs].map(stem))]);
  if (!used) { res.error = '이름 찾기(git grep)가 실패하거나 너무 오래 걸려 자료 · 문서 후보를 내지 않음'; return res; }
  res.assets = assets.filter((f) => !usedBy(used, f));
  res.docs = docs.filter((f) => !usedBy(used, f));
  const all = new Set(files);
  const sibling = (f, base) => all.has(path.posix.join(path.posix.dirname(f), base).replace(/^\.\//, ''));
  const isBackup = (f) => {
    const base = path.basename(f);
    if (BACKUP_EXT.test(base)) return true;
    const m = base.match(SUFFIXED);
    if (m && m[1] && !(CODE_EXT.test(base) && VERSION_MARK.test(base)) && sibling(f, m[1] + (m[2] || ''))) return true;
    const pm = base.match(PREFIXED);
    return !!pm && sibling(f, pm[1]);
  };
  const counted = new Set([...res.assets, ...res.docs]);
  res.backups = pool.filter((f) => !counted.has(f) && isBackup(f));
  if (r.kind === 'code') res.codeTools = codeTools(r.dir);
  return res;
}

function main() {
  const ws = W.load();
  const pick = (val('repo') || '').split(',').map((x) => x.trim()).filter(Boolean);
  const repos = [...ws.repos.filter((r) => r.kind !== 'legacy').map((r) => ({ ...r, self: false })), { name: path.basename(ws.root), dir: ws.root, kind: 'workspace', self: true }]
    .filter((r) => !pick.length || pick.includes(r.name))
    .filter((r) => fs.existsSync(r.dir));
  const unknown = pick.filter((n) => !repos.some((r) => r.name === n));
  if (unknown.length) { console.error(`✖ 없거나 받지 않은 repo: ${unknown.join(', ')}`); process.exitCode = 1; return; }
  const onlyNew = has('new');
  const results = repos.map((r) => scanRepo(r, onlyNew));
  const n = (r) => r.assets.length + r.docs.length + r.backups.length;
  const total = results.reduce((a, r) => a + n(r), 0);
  const fresh = results.reduce((a, r) => a + r.newFiles.length, 0);
  if (has('json')) { console.log(JSON.stringify({ total, newFiles: fresh, repos: results }, null, 2)); return; }
  if (has('count')) {
    const by = results.filter((r) => n(r)).map((r) => `${r.name} ${n(r)}`);
    console.log(total ? `정리 후보 ${total}개 (${by.join(' · ')}) · 이번 작업 새 파일 ${fresh}개. 확인: aidure tidy` : `정리 후보 없음 · 이번 작업 새 파일 ${fresh}개`);
    return;
  }
  const show = (title, list, note = '') => {
    if (!list.length) return;
    console.log(`  ${title} ${list.length}개${note}`);
    for (const f of list.slice(0, MAX)) console.log(`    ${f}`);
    if (list.length > MAX) console.log(`    … 외 ${list.length - MAX}개 (--json 으로 전체)`);
  };
  for (const r of results) {
    if (r.error) { console.log(`⚠ ${r.name}: ${r.error}`); continue; }
    if (!n(r) && !r.newFiles.length && !r.codeTools.length) continue;
    console.log(`■ ${r.name}${r.self ? ' (워크스페이스)' : ''}`);
    show('이번 작업 새 파일', r.newFiles, ': 방향이 바뀌었으면 옛 방식으로 만든 것이 있는지 본다');
    show('안 쓰는 자료', r.assets, ': 어느 글에도 이름이 나오지 않는다');
    show('링크 없는 문서', r.docs, ': 다른 파일이 이름으로 가리키지 않는다');
    show('백업 이름', r.backups, ': 옛 판을 남긴 이름');
    if (r.codeTools.length) console.log(`  코드: ${r.codeTools.join(' · ')} 로 안 쓰는 코드를 찾는다`);
  }
  console.log(total ? `\n정리 후보 ${total}개 · 이번 작업 새 파일 ${fresh}개. 후보는 추정이다: 근거를 확인하고 사용자 승인 뒤에 지운다 (tidy 스킬)` : `\n✔ 정리 후보 없음 · 이번 작업 새 파일 ${fresh}개`);
}

if (require.main === module) main();
module.exports = { BACKUP_EXT, SUFFIXED, PREFIXED, ASSET, PLATFORM_ASSET, scanRepo, newFiles, referenced };
