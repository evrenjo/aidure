#!/usr/bin/env node
// 비밀값(토큰) 관리: 넣기 · 목록 · 확인 · 지우기 · 옛 위치에서 옮기기 · 명령에만 주입. 실행: aidure secret <명령> 또는 node packs/core/bin/secret.js <명령>
/*
 * 명령
 *   set <이름> [--global] [--no-test]   값은 숨김 입력(터미널) 또는 표준 입력. 인자로 받지 않는다 (셸 기록에 남는다)
 *   list [--all]                        이름 · 범위 · 저장소 · 저장일 · 마지막 확인 · 지금 읽는 곳 (값 없음). --all = 다른 프로젝트 범위도
 *   test <이름>                         실제 호출로 유효성 · 권한 · 만료 확인 (gitlab · telegram · npm)
 *   rm <이름> [--global]
 *   import [--global | --project] [--yes]   옛 위치(~/.config/aidure/telegram.env · gitlab-token · ci-npm-token · 같은 이름의 환경변수)에서 옮긴다
 *   exec [--only A,B] -- <명령…>          그 명령에만 환경변수로 넣는다 (기본: 팩이 선언한 비밀값 중 찾은 것)
 * 범위: 기본 = 이 워크스페이스(project.name), --global = 이 PC 의 모든 프로젝트. 찾는 순서: 환경변수 > 프로젝트 > 전역 > 옛 파일
 * 값은 어떤 출력에도 찍지 않는다. 저장소는 lib/secrets.js (macOS 키체인 · Windows 자격 증명 관리자 · Linux libsecret, 못 쓰면 권한 600 파일)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const S = require('../lib/secrets');

const argv = process.argv.slice(2);
const has = (k) => argv.includes(`--${k}`);
const opt = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : null; };
const dd = argv.indexOf('--');
const head = dd >= 0 ? argv.slice(0, dd) : argv;
const positional = head.filter((a, i) => !a.startsWith('--') && !(i > 0 && head[i - 1] === '--only'));
const die = (m) => { console.error(`✖ ${m}`); process.exit(1); };

let ws = null;
try { ws = require('../lib/workspace').load(); } catch { /* 워크스페이스 밖: --global 만 */ }
const project = ws && ws.project && ws.project.name;
const root = ws && ws.root;
const declared = ws ? S.declared(root, ws.packs || []) : [];
const scopeArg = () => {
  if (has('global')) return S.GLOBAL;
  if (!project) die('워크스페이스 밖입니다. 이 PC 의 모든 프로젝트에 쓰려면 --global');
  return project;
};

/** 확인할 때 쓰는 주소: GitLab 은 workspace.json repos 의 gitlab.host 또는 gitlab 이 든 remote 호스트 */
function testContext() {
  const ctx = {};
  for (const r of (ws && ws.repos) || []) {
    if (r.gitlab && r.gitlab.host) { const api = S.gitlabApi(r.gitlab.host, r.gitlab.apiBase); if (api) { ctx.gitlabApi = api; break; } }
    const host = (String(r.remote || '').match(/^(?:[a-z+]+:\/\/)?(?:[^@/]+@)?([^/:]+)/i) || [])[1];
    if (host && /gitlab/i.test(host) && !ctx.gitlabHost) ctx.gitlabHost = host;
  }
  if (process.env.GITLAB_URL) ctx.gitlabApi = `${process.env.GITLAB_URL.replace(/\/$/, '')}/api/v4`;
  try { ctx.npmRegistry = spawnSync('npm', ['config', 'get', 'registry', '--location=user'], { encoding: 'utf8', timeout: 8000, shell: process.platform === 'win32' }).stdout.trim() || undefined; } catch { /* npm 없음 */ }
  return ctx;
}
const kindOf = (name) => {
  const d = declared.find((x) => x.name === name);
  if (d && d.test) return d.test;
  if (/^TELEGRAM_/.test(name)) return 'telegram';
  if (/^GITLAB/.test(name)) return 'gitlab';
  if (/^NPM/.test(name)) return 'npm';
  return null;
};

const readValue = (label) => S.readHidden(`${label} 값 (입력은 보이지 않습니다): `);

async function runTest(name, { quiet } = {}) {
  const got = S.get(name, { project });
  if (!got) { console.log(`✖ ${name}: 값이 없습니다. 넣기: aidure secret set ${name}${declared.find((x) => x.name === name && x.scope === 'global') ? ' --global' : ''}`); return false; }
  const kind = kindOf(name);
  if (!kind) { if (!quiet) console.log(`- ${name} ← ${got.label}: 확인 방법이 없는 이름 (pack.json secrets 의 test 로 정한다)`); return true; }
  const res = await S.test(kind, got.value, testContext());
  S.recordTest(got.scope, name, { at: new Date().toISOString(), ok: res.ok, info: res.info || null, error: res.error || null });
  const d = declared.find((x) => x.name === name);
  const warns = S.testWarnings(res, (d && d.needs) || []);
  console.log(`${res.ok && !warns.length ? '✔' : res.ok ? '⚠' : '✖'} ${name} ← ${got.label} · ${S.testLine(res, new Date(), false)}`);
  for (const w of warns) console.log(`  ⚠ ${w}`);
  if (got.source === 'legacy') console.log(`  ⚠ 옛 파일에서 읽었습니다. 옮기기: aidure secret import`);
  return res.ok && !warns.length;
}

async function cmdSet() {
  const name = positional[1];
  if (!name) die('사용: aidure secret set <이름> [--global]   (값은 숨김 입력 또는 표준 입력)');
  if (positional.length > 2) die('값은 인자로 받지 않습니다 (셸 기록에 남는다). aidure secret set <이름> 만 실행하고 숨김 입력에 넣으세요');
  const scope = scopeArg();
  const value = await readValue(name);
  const r = S.set(name, value, { scope });
  console.log(`✔ ${name} 저장: ${S.scopeLabel(scope)} ${S.STORE_LABEL[r.store]}`);
  if (r.fallback) console.log(`  ⚠ OS 저장소(${S.STORE_LABEL[S.backend()] || S.backend()})를 쓰지 못해 파일에 저장했습니다: ${S.secretsDir()} (본인만 읽기)`);
  if (!has('no-test') && kindOf(name)) await runTest(name, { quiet: true });
}

function cmdList() {
  const all = has('all');
  const stored = S.list().filter((x) => all || x.scope === S.GLOBAL || x.scope === project);
  const names = [...new Set([...declared.map((d) => d.name), ...stored.map((x) => x.name), ...S.legacySources().map((x) => x.name)])].sort();
  if (!names.length) { console.log(`저장한 비밀값이 없습니다. 넣기: aidure secret set <이름> [--global]  (범위: ${project ? `프로젝트 ${project}` : '워크스페이스 밖'})`); return; }
  console.log(`비밀값 (값은 보이지 않습니다) · 저장소 ${S.STORE_LABEL[S.backend()] || S.backend()} · 범위 ${project ? `프로젝트 ${project}` : '워크스페이스 밖'}`);
  for (const name of names) {
    const d = declared.find((x) => x.name === name);
    const now = S.get(name, { project });
    console.log(`\n${name}${d ? `  (${d.pack} 팩: ${d.purpose || ''}${d.needs && d.needs.length ? ` · 권한 ${d.needs.join(', ')}` : ''})` : ''}`);
    console.log(`  지금 읽는 곳: ${now ? now.label : '없음'}`);
    for (const x of stored.filter((y) => y.name === name)) console.log(`  ${S.scopeLabel(x.scope)} · ${S.STORE_LABEL[x.store] || x.store} · 저장 ${x.savedAt || '?'} · 확인 ${x.test ? `${S.localDate(new Date(x.test.at))} ${S.testLine(x.test)}` : '안 함'}`);
    if (!now && d && !d.optional) console.log(`  ⚠ 없음. 넣기: aidure secret set ${name}${d.scope === 'global' ? ' --global' : ''}`);
  }
}

function cmdRm() {
  const name = positional[1];
  if (!name) die('사용: aidure secret rm <이름> [--global]');
  const scope = scopeArg();
  console.log(S.rm(name, { scope }) ? `✔ ${name} 지움: ${S.scopeLabel(scope)}` : `- ${name}: ${S.scopeLabel(scope)} 에 없습니다`);
}

async function ask(q) {
  process.stdout.write(q);
  const buf = Buffer.alloc(64);
  const n = fs.readSync(0, buf, 0, 64, null);
  return buf.slice(0, n).toString('utf8').trim().toLowerCase();
}

async function cmdImport() {
  const found = [...S.legacySources().map((x) => ({ ...x, from: x.file })),
    ...['TELEGRAM_BOT_TOKEN', 'TELEGRAM_TEAM_BOT_TOKEN', 'GITLAB_TOKEN', 'NPM_TOKEN', ...declared.map((d) => d.name)]
      .filter((n, i, a) => a.indexOf(n) === i && process.env[n]).map((n) => ({ name: n, value: process.env[n], from: '환경변수' }))];
  if (!found.length) { console.log('옮길 것이 없습니다 (telegram.env · gitlab-token · ci-npm-token · 환경변수)'); return; }
  const fixed = has('global') ? S.GLOBAL : has('project') ? scopeArg() : null;
  if (!fixed && !process.stdin.isTTY) die('범위를 고르세요: aidure secret import --global 또는 --project');
  const moved = [];
  for (const f of found) {
    let scope = fixed;
    if (!scope) {
      const def = (declared.find((d) => d.name === f.name) || {}).scope === 'project' && project ? 'p' : 'g';
      const a = await ask(`${f.name} (${f.from}) → [p] 프로젝트${project ? `(${project})` : ''} · [g] 전역 · [s] 건너뜀 (기본 ${def}): `);
      const pick = a || def;
      if (pick === 's') continue;
      scope = pick === 'p' ? scopeArg() : S.GLOBAL;
    }
    const r = S.set(f.name, f.value, { scope });
    moved.push(f);
    console.log(`✔ ${f.name} ← ${f.from} → ${S.scopeLabel(scope)} ${S.STORE_LABEL[r.store]}`);
  }
  // 옛 파일: 지우지 않고 *.migrated 로. telegram.env 는 채팅 ID 가 남아 있어 토큰 줄만 빼고 사본을 남긴다
  const files = [...new Set(moved.filter((m) => m.file).map((m) => m.file))];
  for (const file of files) {
    if (path.basename(file) === 'telegram.env') {
      fs.copyFileSync(file, `${file}.migrated`);
      fs.chmodSync(`${file}.migrated`, 0o600);
      const keep = fs.readFileSync(file, 'utf8').split('\n').filter((l) => !moved.some((m) => m.file === file && new RegExp(`^\\s*${m.name}\\s*=`).test(l)));
      fs.writeFileSync(file, keep.join('\n'), { mode: 0o600 });
      console.log(`  ${file}: 토큰 줄을 뺐습니다 (채팅 ID 는 그대로). 원본 사본 ${path.basename(file)}.migrated`);
    } else { fs.renameSync(file, `${file}.migrated`); console.log(`  ${file} → ${path.basename(file)}.migrated`); }
  }
  if (moved.some((m) => m.from === '환경변수')) console.log('  환경변수는 셸 설정(~/.zshrc 등)에서 직접 지우세요. 환경변수가 저장소보다 먼저 읽힙니다');
}

function cmdExec() {
  if (dd < 0 || dd === argv.length - 1) die('사용: aidure secret exec [--only A,B] -- <명령…>');
  const names = opt('only') ? opt('only').split(',').map((x) => x.trim()).filter(Boolean) : declared.map((d) => d.name);
  const env = { ...process.env };
  const used = [];
  for (const n of names) { const g = S.get(n, { project }); if (g) { env[n] = g.value; used.push(`${n} ← ${g.label}`); } }
  console.error(`aidure secret exec: ${used.length ? used.join(' · ') : '넣을 비밀값 없음'}`);
  const [cmd, ...args] = argv.slice(dd + 1);
  const [file, list, shell] = winSafe(cmd, args);
  const r = spawnSync(file, list, { stdio: 'inherit', env, shell });
  process.exit(r.status == null ? 1 : r.status);
}

/* Windows: .exe 는 셸 없이 바로. .cmd · .bat 은 셸(cmd.exe)이 필요해 인자를 따옴표로 묶고, 따옴표 안에서도 해석되는 " % ! 줄바꿈이 든 인자는 받지 않는다 (명령 주입 막기) */
function winPath(cmd) {
  if (process.platform !== 'win32') return cmd;
  const w = spawnSync('where', [cmd], { encoding: 'utf8' });
  const lines = w.status === 0 ? w.stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : [];
  return lines.find((l) => /\.(exe|com|cmd|bat)$/i.test(l)) || cmd;
}
function winSafe(cmd, args) {
  if (process.platform !== 'win32') return [cmd, args, false];
  const full = winPath(cmd);
  if (/\.(exe|com)$/i.test(full)) return [full, args, false];
  const bad = [cmd, ...args].find((a) => /["%!\r\n]/.test(a));
  if (bad !== undefined) die(`Windows 에서 .cmd 명령에는 " % ! 줄바꿈이 든 인자를 넘길 수 없습니다: ${bad}`);
  return [`"${full}"`, args.map((a) => `"${a}"`), true];
}

async function main() {
  const cmd = positional[0];
  if (cmd === 'set') return cmdSet();
  if (cmd === 'list' || cmd === 'ls' || !cmd) return cmdList();
  if (cmd === 'test') { if (!positional[1]) die('사용: aidure secret test <이름>'); return process.exit((await runTest(positional[1])) ? 0 : 1); }
  if (cmd === 'rm') return cmdRm();
  if (cmd === 'import') return cmdImport();
  if (cmd === 'exec') return cmdExec();
  die('사용: aidure secret set <이름> [--global] · list [--all] · test <이름> · rm <이름> [--global] · import [--global|--project] · exec [--only A,B] -- <명령>');
}

main().catch((e) => die(e.message));
