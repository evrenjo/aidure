#!/usr/bin/env node
// 파일·폴더를 옮기면서 그것을 가리키는 참조를 함께 고친다. 실행: node packs/core/bin/rename-ref.js <old> <new> [--apply] [--repos] | --check <old>
/*
 *   node packs/core/bin/rename-ref.js --check <old>          누가 이 경로를 가리키는지만 본다
 *   node packs/core/bin/rename-ref.js <old> <new>            미리보기 (아무것도 안 바꾼다)
 *   node packs/core/bin/rename-ref.js <old> <new> --apply    참조 갱신 → git mv → kit sync → 죽은 참조 검사
 *   --repos  workspace.json repos 안의 .md 도 찾아 고친다 (각 repo 에서 따로 커밋해야 한다)
 *
 * 경로는 워크스페이스 루트 기준. 고치는 곳: README.md · docs/** · packs/** (정본).
 * 생성물(AGENTS.md·CLAUDE.md·.agents·.claude)은 직접 고치지 않고 --apply 끝에 kit sync 로 다시 만든다.
 * handoffs/ 는 건드리지 않는다 — 지난 사실의 기록이다.
 * 루트 기준 표기, "그 문서 폴더 기준 상대 표기", 룰이면 생성 경로(.agents/rules/<팩>--<파일>) 까지 고친다. 파일명만 적힌 곳은 목록으로만 알린다.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { load } = require('../lib/workspace');

const ws = load();
const ROOT = ws.root;
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const CHECK_ONLY = args.includes('--check');
const WITH_REPOS = args.includes('--repos');
const pos = args.filter((a) => !a.startsWith('--'));

if (CHECK_ONLY ? pos.length !== 1 : pos.length !== 2) {
  console.error('사용: node packs/core/bin/rename-ref.js <old> <new> [--apply] [--repos]   |   --check <old>');
  process.exit(2);
}
const clean = (p) => p.replace(/^\.\//, '').replace(/\/+$/, '');
const OLD = clean(pos[0]);
const NEW = CHECK_ONLY ? null : clean(pos[1]);
const slash = (p) => (p == null ? p : p.split(path.sep).join('/'));
const rel = (f) => slash(path.relative(ROOT, f));

const SKIP = new Set(['.git', 'node_modules', 'backup', '.backup', 'handoffs', 'target', 'build', 'dist']);
function walk(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(path.join(dir, e.name), out); }
    else if (e.name.endsWith('.md')) out.push(path.join(dir, e.name));
  }
  return out;
}

const ownDocs = [path.join(ROOT, 'README.md'), ...walk(path.join(ROOT, 'docs')), ...walk(path.join(ROOT, 'packs'))].filter((f) => fs.existsSync(f));
const repoDocs = WITH_REPOS ? ws.repos.filter((r) => fs.existsSync(r.dir)).flatMap((r) => walk(r.dir)) : [];
const ownSet = new Set(ownDocs);

/** 생성 룰 경로 — packs/<p>/rules/<f>.md 는 .agents/rules/<p>--<f>.md 로 렌더되어 그 이름으로도 참조된다 */
function generatedRule(p) {
  const m = p && p.match(/^packs\/([^/]+)\/rules\/(.+\.md)$/);
  return m ? `.agents/rules/${m[1]}--${m[2].replace(/\//g, '--')}` : null;
}

/** doc 에서 OLD 를 가리킬 수 있는 표기들 → NEW 표기. rel=true 는 상대 표기(앞에 경로 문자가 붙으면 다른 이름이다) */
function forms(doc) {
  const out = [{ from: OLD, to: NEW, rel: false }];
  const gOld = generatedRule(OLD);
  if (gOld) out.push({ from: gOld, to: generatedRule(NEW), rel: false });
  const relOld = slash(path.relative(path.dirname(doc), path.join(ROOT, OLD)));
  // 옮기는 폴더 안 문서면 상대경로가 빈 문자열이 된다 — 빈 문자열 치환은 파일을 통째로 깨뜨리므로 제외
  if (relOld && !relOld.startsWith('..') && relOld !== OLD) {
    out.push({ from: relOld, to: NEW ? slash(path.relative(path.dirname(doc), path.join(ROOT, NEW))) : null, rel: true });
  }
  return out;
}

const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** 경로 경계에서만 맞춘다 — `30-x.md` 가 `core--30-x.md` 안에서, `a.md` 가 `a.mdx` 안에서 잡히지 않게 */
function pattern(f) {
  return new RegExp(`${f.rel ? '(?<![A-Za-z0-9_./-])' : '(?<![A-Za-z0-9_.-])'}${esc(f.from)}(?![A-Za-z0-9_])`, 'g');
}

const edits = [];
const basenameOnly = [];
const oldBase = path.basename(OLD);
for (const doc of [...ownDocs, ...repoDocs]) {
  const text = fs.readFileSync(doc, 'utf8');
  let hit = false;
  for (const f of forms(doc)) {
    const n = (text.match(pattern(f)) || []).length;
    if (!n) continue;
    hit = true;
    edits.push({ file: doc, ...f, count: n, own: ownSet.has(doc) });
  }
  if (!hit && oldBase.length > 6) {
    const n = text.split('`' + oldBase + '`').length - 1;
    if (n) basenameOnly.push({ file: doc, count: n });
  }
}

console.log(CHECK_ONLY ? `참조 조회: ${OLD}` : `${APPLY ? '적용' : '미리보기'}: ${OLD}  →  ${NEW}`);
const show = (list, label) => {
  if (!list.length) return;
  console.log(`\n${label}`);
  for (const e of list) {
    console.log(`  ${rel(e.file)}  (${e.count}곳)`);
    if (e.to != null) console.log(`      ${e.from}  →  ${e.to}`);
  }
};
show(edits.filter((e) => e.own), '── 워크스페이스 정본 (자동 갱신)');
show(edits.filter((e) => !e.own), '── repo 문서 (자동 갱신. 각 repo 에서 따로 커밋)');
if (basenameOnly.length) {
  console.log('\n── 파일명만 적힌 곳: 문맥을 보고 직접 판단 (자동 치환 안 함)');
  for (const e of basenameOnly) console.log(`  ${rel(e.file)}  (${e.count}곳)  \`${oldBase}\``);
}
const total = edits.reduce((a, e) => a + e.count, 0);
console.log(`\n참조 ${total}곳 / 파일 ${new Set(edits.map((e) => e.file)).size}개${WITH_REPOS ? '' : '  (repo 문서까지 보려면 --repos)'}`);

if (CHECK_ONLY) process.exit(0);
if (!fs.existsSync(path.join(ROOT, OLD))) { console.error(`\n중단: ${OLD} 가 없다.`); process.exit(1); }
if (fs.existsSync(path.join(ROOT, NEW))) { console.error(`\n중단: ${NEW} 가 이미 있다.`); process.exit(1); }
if (!APPLY) { console.log('\n미리보기만 했다. 실제로 바꾸려면 --apply 를 붙인다.'); process.exit(0); }

// 1) 참조 갱신을 이동보다 먼저 — 옮기는 폴더 안 문서도 옛 경로에서 고친 뒤 함께 옮겨진다
for (const e of edits) {
  if (!e.from) { console.error(`중단: 빈 문자열 치환 (${rel(e.file)}). 파일을 건드리지 않았다.`); process.exit(1); }
  if (e.to == null) { console.log(`  건너뜀: ${rel(e.file)} 의 \`${e.from}\`: 새 경로가 룰 폴더가 아니라 대응 이름이 없다. 직접 고친다.`); continue; }
  const t = fs.readFileSync(e.file, 'utf8');
  fs.writeFileSync(e.file, t.replace(pattern(e), () => e.to), 'utf8');
}
console.log(`\n참조 ${total}곳 갱신`);

// 2) 이동 — git 추적이면 git mv 로 이력 보존
fs.mkdirSync(path.dirname(path.join(ROOT, NEW)), { recursive: true });
let how = 'mv';
try {
  execFileSync('git', ['-C', ROOT, 'ls-files', '--error-unmatch', OLD], { stdio: 'ignore' });
  execFileSync('git', ['-C', ROOT, 'mv', OLD, NEW], { stdio: 'inherit' });
  how = 'git mv';
} catch {
  fs.renameSync(path.join(ROOT, OLD), path.join(ROOT, NEW));
}
console.log(`${how}: ${OLD} → ${NEW}`);

// 3) 생성물 다시 만들기 + 죽은 참조 검사
const run = (label, cmd, cmdArgs) => {
  console.log(`\n── ${label}`);
  try { execFileSync(cmd, cmdArgs, { cwd: ROOT, stdio: 'inherit' }); } catch { /* 결과는 출력으로 본다 */ }
};
if (fs.existsSync(path.join(ROOT, 'bin', 'kit.js'))) run('kit sync', 'node', [path.join(ROOT, 'bin', 'kit.js'), 'sync']);
run('죽은 참조 검사', 'node', [path.join(__dirname, 'check-refs.js')]);

const repos = [...new Set(edits.filter((e) => !e.own).map((e) => rel(e.file).split('/')[0]))];
if (repos.length) console.log(`\n⚠️ repo 문서를 고쳤다. 각 repo 에서 따로 커밋·푸시해야 한다: ${repos.join(', ')}`);
if (basenameOnly.length) console.log('⚠️ "파일명만 적힌 곳" 은 그대로다. 문맥을 보고 직접 고친다.');
