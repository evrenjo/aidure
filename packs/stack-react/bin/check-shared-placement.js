#!/usr/bin/env node
// 화면 공용 폴더(shared/) 배치 검사 — 역참조 · 한 곳 전용 · `// Used by:` 정합. 실행: node packs/stack-react/bin/check-shared-placement.js [--list] [--scope <viewsDir 기준 경로>] [--repo <경로>]
/*
 * 규칙 (packs/frontend/rules/20-structure-and-api.md §파일 위치·이름):
 *   views/{도메인}/{모듈}/{화면}/   그 화면만 쓴다
 *   views/{도메인}/{모듈}/shared/   그 모듈의 화면들만 쓴다
 *   views/{도메인}/shared/          모듈을 넘어 쓴다
 *
 * shared 폴더 하나 = "풀", 그 부모 폴더 = "범위(scope)". 검사 3가지:
 *   ① 풀 → 범위 안 형제 모듈 import   (shared 가 자기 소비자를 import 하면 방향이 뒤집힌다)
 *   ② 소비처가 1곳뿐인 풀 파일        (그 소비처로 내려야 한다)
 *   ③ `// Used by: a · b(C · D)` 줄이 실제 importer 와 다름 (적힌 경로는 viewsDir 기준 또는 조상 폴더 기준)
 *
 * 소비처는 viewsDir 전체에서 센다 — 다른 도메인도 공용 파일을 쓴다. 범위 밖 importer 는
 * 범위와 갈라지는 첫 폴더로 묶는다 (범위 a/b 에 대해 a/c/x.tsx → a/c, d/y.tsx → d).
 * 같은 풀 안 importer 는 그 파일의 소비처로 풀어 올린다. 테스트·스토리 파일은 소비처로 세지 않는다.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { resolve } = require('./lib/react-repo');

const argv = process.argv.slice(2);
const LIST = argv.includes('--list');
const ARG_SCOPES = argv.reduce((a, x, i) => (x === '--scope' && argv[i + 1] ? [...a, argv[i + 1].replace(/^\/|\/$/g, '')] : a), []);

const { cfg, dir, name, why } = resolve(argv);
if (!dir) {
  console.log(`건너뜀: 프론트 repo 를 찾지 못했습니다: ${why}`);
  process.exit(argv.includes('--repo') ? 2 : 0);
}
const BASE = path.join(dir, cfg.viewsDir || 'src/views');
if (!fs.existsSync(BASE)) {
  console.log(`건너뜀: ${name} 에 ${cfg.viewsDir} 가 없습니다 (vars.react.viewsDir)`);
  process.exit(argv.includes('--repo') ? 2 : 0);
}
const placement = cfg.sharedPlacement || {};
const SCOPES = ARG_SCOPES.length ? ARG_SCOPES : (placement.scopes || []);
const EXCLUDE = placement.exclude || [];
const ALIASES = Object.entries(cfg.aliases || { '@/': 'src/' });

const posix = (p) => p.split(path.sep).join('/');
const stripExt = (p) => p.replace(/\.(tsx?|jsx?)$/, '');

function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(tsx?|jsx?)$/.test(e.name) && !e.name.endsWith('.d.ts')) acc.push(posix(path.relative(BASE, p)));
  }
  return acc;
}

// 테스트·스토리 파일은 소비처가 아니다 — import 는 세되 importer 로는 넣지 않는다
const isTest = (f) => /\.(test|spec|stories)\.(tsx?|jsx?)$/.test(f) || f.split('/').includes('__tests__');
const files = walk(BASE).sort();
const byKey = new Map(files.map((f) => [stripExt(f), f]));
const text = new Map(files.map((f) => [f, fs.readFileSync(path.join(BASE, f), 'utf8')]));

/** import 스펙을 viewsDir 기준 파일로. views 밖이면 null. */
function resolveSpec(from, spec) {
  let abs = null;
  if (spec.startsWith('.')) abs = path.resolve(path.dirname(path.join(BASE, from)), spec);
  else {
    const hit = ALIASES.find(([prefix]) => spec.startsWith(prefix));
    if (hit) abs = path.join(dir, hit[1], spec.slice(hit[0].length));
  }
  if (!abs) return null;
  const rel = posix(path.relative(BASE, abs));
  if (rel.startsWith('..')) return null;
  const key = stripExt(rel);
  return byKey.get(key) || byKey.get(`${key}/index`) || null;
}

const IMPORT_RE = /(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g;
const importsOf = new Map();
const importersOf = new Map(files.map((f) => [f, []]));
for (const f of files) {
  const set = new Set();
  for (const m of text.get(f).matchAll(IMPORT_RE)) {
    const t = resolveSpec(f, m[1]);
    if (t && t !== f) set.add(t);
  }
  importsOf.set(f, set);
  if (!isTest(f)) for (const t of set) importersOf.get(t).push(f);
}

// 풀 = 경로에 'shared' 폴더가 있는 파일의 가장 깊은 shared 폴더
function poolOf(f) {
  const segs = f.split('/');
  for (let i = segs.length - 2; i >= 0; i -= 1) if (segs[i] === 'shared') return segs.slice(0, i + 1).join('/');
  return null;
}
const scopeOf = (pool) => pool.split('/').slice(0, -1).join('/');
const inScope = (f, scope) => scope === '' || f.startsWith(`${scope}/`);
const excluded = (f) => EXCLUDE.some((p) => f === p || f.startsWith(`${p.replace(/\/$/, '')}/`));
const wanted = (pool) => !SCOPES.length || SCOPES.includes(scopeOf(pool));

/** importer 를 범위 기준 소비 모듈 이름으로 */
function label(importer, scope) {
  const a = importer.split('/');
  const s = scope ? scope.split('/') : [];
  let k = 0;
  while (k < s.length && a[k] === s[k]) k += 1;
  return a.slice(0, Math.min(k + 1, a.length)).join('/');
}

function consumerModules(f, pool, seen = new Set()) {
  if (seen.has(f)) return new Set();
  seen.add(f);
  const out = new Set();
  for (const imp of importersOf.get(f)) {
    if (poolOf(imp) === pool) for (const x of consumerModules(imp, pool, seen)) out.add(x);
    else out.add(label(imp, scopeOf(pool)));
  }
  return out;
}

const violations = [];
const sharedFiles = files.filter((f) => poolOf(f) && !isTest(f) && !excluded(f) && wanted(poolOf(f)));

for (const f of sharedFiles) {
  const pool = poolOf(f);
  const scope = scopeOf(pool);
  // ① 범위 안 모듈(하위 폴더) import — 같은 풀·범위 바로 아래 파일은 제외
  for (const t of importsOf.get(f)) {
    if (!inScope(t, scope) || t.startsWith(`${pool}/`)) continue;
    const rest = scope ? t.slice(scope.length + 1) : t;
    if (rest.includes('/')) violations.push(`① ${f} 가 범위(${scope || '/'}) 안 모듈을 import 한다 → ${t}`);
  }
  // ② 한 곳 전용
  const mods = consumerModules(f, pool);
  if (mods.size === 1) violations.push(`② ${f} 는 ${[...mods][0]} 한 곳만 쓴다 → 그쪽으로 내린다`);
}

// ③ Used by 정합 — 선언된 경로는 viewsDir 기준 또는 그 파일의 조상 폴더 기준으로 읽는다
const matches = (actual, decl, prefixes) => prefixes.some((p) => {
  const d = p ? `${p}/${decl}` : decl;
  return actual === d || actual.startsWith(`${d}/`) || stripExt(actual) === d;
});
let usedByCount = 0;
for (const f of files) {
  if (excluded(f)) continue;
  if (SCOPES.length && !SCOPES.some((s) => inScope(f, s))) continue;
  const m = text.get(f).match(/^\/\/ Used by: (.+)$/m);
  if (!m) continue;
  usedByCount += 1;
  const declared = m[1].replace(/\([^)]*\)/g, '').split('·').map((s) => s.replace(/[.\s]+$/, '').trim()).filter(Boolean);
  const segs = f.split('/').slice(0, -1);
  const prefixes = [''].concat(segs.map((_, i) => segs.slice(0, i + 1).join('/')));
  const actual = importersOf.get(f);
  const missing = actual.filter((a) => !declared.some((d) => matches(a, d, prefixes)));
  if (missing.length) violations.push(`③ ${f} 의 「Used by」 에 없는 실제 사용처: ${missing.join(', ')}`);
  const extra = declared.filter((d) => !actual.some((a) => matches(a, d, prefixes)));
  if (extra.length) violations.push(`③ ${f} 의 「Used by」 에 적혔지만 실제로 안 쓰는 곳: ${extra.join(', ')}`);
}

if (LIST) {
  console.log(`shared 파일별 소비처 (${cfg.viewsDir} 전체 기준)\n`);
  for (const f of sharedFiles) console.log(`  ${f.padEnd(60)} ${[...consumerModules(f, poolOf(f))].sort().join(' ') || '(없음)'}`);
  console.log('');
}

const pools = new Set(sharedFiles.map(poolOf));
const scale = `shared 폴더 ${pools.size}개 · 파일 ${sharedFiles.length}개 · Used by ${usedByCount}개 (${cfg.viewsDir} ${files.length}파일 대조)`;
if (!sharedFiles.length && !usedByCount) {
  console.log(`⚠ 검사 대상 0: ${scale}. scopes·exclude 설정이 맞는지 확인하세요`);
  process.exit(0);
}
if (violations.length) {
  console.log(`✗ shared 배치 위반 ${violations.length}건. ${scale}\n`);
  for (const v of violations) console.log(`  ${v}`);
  console.log('\n  정본: frontend 레이어 룰 §파일 위치·이름 (packs/frontend/rules/20-structure-and-api.md)');
  process.exit(1);
}
console.log(`✓ shared 배치 정상: ${scale} · 위반 0`);
