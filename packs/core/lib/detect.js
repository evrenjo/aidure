// repo 폴더를 보고 스택을 감지한다 (packs/core/stacks.json + workspace.json stackHints). 사용: require('.../detect').detect(dir, withHints(catalog, hints))
'use strict';
const fs = require('fs');
const path = require('path');

// .devcontainer: 개발 컨테이너 설정(Dockerfile · compose)은 앱의 배포 인프라가 아니다
// 내려받은 의존성 · 도구 캐시(Pods · .dart_tool · site-packages 등)도 그 repo 가 쓴 코드가 아니라 건너뛴다
const SKIP = new Set(['.git', 'node_modules', 'build', 'dist', 'target', 'out', '.gradle', '.idea', '.vscode', '.devcontainer', 'venv', '.venv', '__pycache__', 'vendor', 'bin', 'obj', 'coverage',
  'Pods', 'Carthage', '.build', 'DerivedData', '.dart_tool', '.pub-cache', '.symlinks', '.tox', '.nox', 'site-packages', '.eggs', '.mypy_cache', '.pytest_cache',
  '.next', '.nuxt', '.svelte-kit', '.angular', '.turbo', '.output', '.expo']);
const MAX_DEPTH = 4;      // 조건의 기본 깊이 — 빌드·설정 파일은 대부분 여기 안에 있다
const DEEP_LIMIT = 10;    // 조건에 depth 를 적으면 이 깊이까지 (소스 파일 표식용)
const MAX_FILES = 50000;  // 거대 repo 에서 멈추지 않게
const MAX_BYTES = 512 * 1024;
const BUILD_FILES = ['pom.xml', 'build.gradle', 'build.gradle.kts', 'package.json', 'pyproject.toml', 'requirements*.txt', 'go.mod', '*.csproj', 'pubspec.yaml', 'Podfile', 'Package.swift', 'Cargo.toml', 'composer.json', 'Gemfile'];

function loadCatalog(root) {
  return JSON.parse(fs.readFileSync(path.join(root, 'packs', 'core', 'stacks.json'), 'utf8')).stacks;
}

const toRegex = (glob) => new RegExp(`^${glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`, 'i');

/**
 * 깊이 maxDepth 까지 파일 목록 [{ file, depth }]. depth 는 파일이 든 폴더의 깊이 (repo 루트 = 0).
 * 얕은 폴더부터 훑는다 (MAX_FILES 에 걸려도 빌드 · 설정 파일이 있는 위쪽은 빠지지 않게)
 */
function index(dir, maxDepth = MAX_DEPTH, skip = SKIP, maxFiles = MAX_FILES) {
  const files = [];
  let level = [dir];
  for (let depth = 0; level.length && files.length < maxFiles; depth++) {
    const next = [];
    for (const d of level) {
      if (files.length >= maxFiles) break;
      let ents;
      try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; }
      for (const e of ents) {
        if (files.length >= maxFiles) break;
        if (e.isDirectory()) { if (depth < maxDepth && !skip.has(e.name)) next.push(path.join(d, e.name)); }
        else if (e.isFile()) files.push({ file: path.join(d, e.name), depth });
      }
    }
    level = next;
  }
  return files;
}

const depthOf = (cond) => Math.min(Number(cond.depth) || MAX_DEPTH, DEEP_LIMIT);

/**
 * 워크스페이스가 적은 감지 힌트를 목록에 합친다. 사내 라이브러리가 프레임워크를 전이 의존으로 끌어오면
 * 빌드 파일에 프레임워크 이름이 없어 감지가 안 된다 — 그 라이브러리 좌표를 힌트로 적는다.
 * hint = { stack, contains, files?, depth? } · files 를 빼면 그 스택의 감지 조건에 나오는 파일들
 */
function withHints(catalog, hints = []) {
  if (!Array.isArray(hints) || !hints.length) return catalog;
  return catalog.map((s) => {
    const mine = hints.filter((h) => h && h.stack === s.id && h.contains);
    if (!mine.length) return s;
    const files = [...new Set((s.detect || []).flatMap((c) => c.files))];
    return { ...s, detect: [...(s.detect || []), ...mine.map((h) => ({ files: h.files && h.files.length ? h.files : files.length ? files : BUILD_FILES, contains: h.contains, depth: h.depth, hint: true }))] };
  });
}

/** 힌트 검사 — [오류 문장]. 모르는 스택·잘못된 정규식 */
function checkHints(catalog, hints) {
  const errs = [];
  if (hints === undefined) return errs;
  if (!Array.isArray(hints)) return ['stackHints 는 배열이어야 합니다'];
  hints.forEach((h, i) => {
    const at = `stackHints[${i}]`;
    if (!h || !h.stack || !h.contains) { errs.push(`${at}: stack 과 contains 가 필요합니다`); return; }
    if (!catalog.some((c) => c.id === h.stack)) errs.push(`${at}: 모르는 스택 '${h.stack}': packs/core/stacks.json 의 id`);
    try { new RegExp(h.contains, 'im'); } catch (e) { errs.push(`${at}: contains 정규식 오류. ${e.message}`); }
  });
  return errs;
}

/** 빌드 파일이 있는가 — 스택이 하나도 안 잡혔는데 빌드 파일이 있으면 간접 의존일 수 있다 */
function buildFiles(dir) {
  const names = BUILD_FILES.map(toRegex);
  return index(dir).filter((f) => names.some((n) => n.test(path.basename(f.file)))).map((f) => path.relative(dir, f.file).split(path.sep).join('/'));
}

/** 근거 파일이 속한 모듈 — 위로 올라가며 빌드 파일이 있는 첫 폴더 (repo 루트거나 빌드 파일이 없으면 '.' — 경계를 모르면 repo 전체) */
function moduleOf(dir, file) {
  const names = BUILD_FILES.map(toRegex);
  for (let d = path.dirname(file); ; d = path.dirname(d)) {
    let ents = [];
    try { ents = fs.readdirSync(d); } catch { /* 못 읽으면 다음 위로 */ }
    if (ents.some((e) => names.some((n) => n.test(e)))) return path.relative(dir, d).split(path.sep).join('/') || '.';
    if (path.relative(dir, d) === '' || d === path.dirname(d)) return '.';
  }
}

/**
 * 감지 결과: [{ id, evidence: '상대경로', modules? }] — 조건마다 파일 이름 일치 + (있으면) 내용 정규식 일치.
 * modules = 그 스택이 쓰이는 하위 모듈 (멀티모듈 repo 의 api/·client/ 등). repo 전체에 걸치면 빠진다
 */
function detect(dir, catalog, scanned = null) {
  if (!fs.existsSync(dir)) return [];
  const files = scanned ? scanned.filter((x) => !path.relative(dir, x.file).split(path.sep).slice(0, -1).some((seg) => SKIP.has(seg)))
    : index(dir, Math.max(MAX_DEPTH, ...catalog.flatMap((s) => (s.detect || []).map(depthOf))));
  const cache = new Map();
  const content = (f) => {
    if (!cache.has(f)) {
      let t = '';
      try { if (fs.statSync(f).size <= MAX_BYTES) t = fs.readFileSync(f, 'latin1'); } catch { /* 읽기 실패 = 빈 내용 */ }
      cache.set(f, t);
    }
    return cache.get(f);
  };
  const found = [];
  for (const s of catalog) {
    let hit = null;
    for (const cond of s.detect || []) {
      const names = cond.files.map(toRegex);
      // caseSensitive: 내용 정규식을 대소문자 구분으로 · notIn: 이 이름의 폴더 안 파일은 뺀다 (시험 자료 등)
      const re = cond.contains ? new RegExp(cond.contains, cond.caseSensitive ? 'm' : 'im') : null;
      const depth = depthOf(cond);
      const out = (f) => (cond.notIn || []).length && path.relative(dir, f).split(path.sep).slice(0, -1).some((seg) => cond.notIn.includes(seg));
      const all = files.filter((x) => x.depth <= depth && names.some((n) => n.test(path.basename(x.file))) && !out(x.file) && (!re || re.test(content(x.file))));
      if (all.length) { hit = { file: all[0].file, all, hint: !!cond.hint }; break; }
    }
    if (!hit) continue;
    // 루트 빌드 파일이 하위 모듈을 설정만 하는 경우(Gradle 멀티모듈)가 흔하다 — 하위 모듈이 따로 잡히면 루트는 뺀다
    let modules = [...new Set(hit.all.map((x) => moduleOf(dir, x.file)))];
    const atRoot = modules.includes('.'); // 루트에서도 잡혔다 (하위 모듈과 함께면 아래에서 빠진다)
    if (modules.length > 1) modules = modules.filter((m) => m !== '.');
    found.push({ id: s.id, evidence: path.relative(dir, hit.file).split(path.sep).join('/') + (hit.hint ? ' (힌트)' : ''),
      ...(modules.includes('.') ? {} : { modules: modules.sort(), ...(atRoot ? { atRoot: true } : {}) }) });
  }
  return found;
}

const SCAN_MAX_FILES = 200000; // 깊이 훑으면 얕은 파일로 상한이 먼저 차 깊은 소스를 못 센다
const LANG_DEPTH = 16;      // 소스 파일을 세는 깊이 (src/main/java/kr/co/회사/프로젝트/… 같은 깊은 패키지까지)
/** 언어 감지용 파일 목록 (스택 감지보다 깊게: src/main/java/kr/co/… 같은 깊은 패키지까지) */
// 언어를 셀 때는 bin/ · out/ 도 본다 (Node CLI 는 bin/ 에 소스를 둔다). 스택 감지(detect)는 원래 SKIP 으로 거른다
const LANG_SKIP = new Set([...SKIP].filter((x) => !['bin', 'out'].includes(x)));
function scan(dir) { return index(dir, LANG_DEPTH, LANG_SKIP, SCAN_MAX_FILES); }

const LANG_MIN_FILES = 5;    // 이만큼 있으면서
const LANG_MIN_PART = 0.1;   // 감지 대상 소스의 이 비율 이상이거나 (큰 repo 의 보조 스크립트 몇 개는 빠진다)
const LANG_MIN_SHARE = 0.5;  // 절반을 넘으면 그 언어 (파일 몇 개뿐인 작은 repo 도)
/**
 * repo 의 언어: 소스 파일 확장자 수로 고른다. [{ id, files }] (많은 순). 5개 이상이면서 10% 이상이거나 절반 이상이면 그 언어.
 * 서버 repo 의 보조 스크립트 몇 개는 빠진다. ignore = 세지 않을 폴더 (repo 기준 경로, 크로스 플랫폼 앱의 ios/ · windows/ 등)
 */
function detectLanguages(dir, languages, scanned = null, ignore = []) {
  if (!fs.existsSync(dir) || !languages.length) return [];
  const byExt = new Map();
  for (const l of languages) for (const e of l.ext || []) byExt.set(e.toLowerCase(), l.id);
  const count = new Map();
  for (const { file } of scanned || scan(dir)) {
    const base = path.basename(file);
    if (/\.d\.ts$|\.config\.[cm]?[jt]s$|^\.[\w-]+rc\.[cm]?js$/i.test(base)) continue; // 타입 선언 · 도구 설정 파일은 그 repo 의 언어가 아니다
    const rel = path.relative(dir, file).split(path.sep).join('/');
    if (ignore.some((p) => rel.startsWith(`${p}/`))) continue;
    const ext = path.extname(file).slice(1).toLowerCase();
    const id = byExt.get(ext);
    if (id) count.set(id, (count.get(id) || 0) + 1);
  }
  const total = [...count.values()].reduce((a, b) => a + b, 0);
  // 반반이면 둘 다 붙지 않게 절반 '초과'. 기준을 넘는 언어가 없으면 가장 많은 언어 (작은 repo)
  const pick = [...count.entries()].filter(([, n]) => (n >= LANG_MIN_FILES && n / total >= LANG_MIN_PART) || n / total > LANG_MIN_SHARE);
  const top = Math.max(0, ...count.values());
  return (pick.length ? pick : [...count.entries()].filter(([, n]) => n === top && n > 0))
    .sort((a, b) => b[1] - a[1]).map(([id, files]) => ({ id, files }));
}

module.exports = { detect, scan, loadCatalog, withHints, checkHints, buildFiles, detectLanguages };
