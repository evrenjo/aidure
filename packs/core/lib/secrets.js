// 비밀값(토큰) 저장 · 읽기: OS 저장소(macOS 키체인 · Windows 자격 증명 관리자 · Linux libsecret), 못 쓰면 권한 600 파일. 값은 어디에도 출력하지 않는다
/*
 * 범위: 프로젝트(workspace.json project.name. 경로가 아니라 이름이라 다른 폴더에 clone 해도 같은 값) · 전역(global)
 * 찾는 순서 (get): 환경변수 > 프로젝트 > 전역 > 옛 파일(~/.config/aidure/telegram.env · gitlab-token · ci-npm-token). git credential 은 쓰는 도구가 마지막에 본다
 * 저장 키: macOS service=aidure:<범위> account=<이름> · Windows target=aidure:<범위>:<이름>(Generic) · Linux aidure-scope=<범위> aidure-name=<이름> · 파일 <설정 폴더>/secrets/<범위>.json
 * 목록(index.json, 같은 폴더)에는 이름 · 범위 · 저장소 · 저장일 · 마지막 확인 결과만 둔다 (값 없음). 읽을 때 목록에 있는 범위만 저장소를 찾아 훅이 느려지지 않게 한다
 * 시험용: AIDURE_CONFIG_DIR(설정 폴더) · AIDURE_SECRETS_BACKEND=file|keychain|wincred|libsecret
 * 값은 인자(argv)로 넘기지 않는다: 키체인은 security -i 의 표준 입력(16진수 -X: 따옴표 · 역슬래시 · 한글이 깨지지 않게), libsecret 은 secret-tool 의 표준 입력, Windows 는 PowerShell 표준 입력(JSON)
 * 키체인 읽기는 -g 의 「password: "…"」 또는 「password: 0x…」 를 푼다 (-w 는 ASCII 밖 값을 16진수로 내보내 원래 값과 구별할 수 없다)
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const GLOBAL = 'global';
const NAME_RE = /^[A-Z][A-Z0-9_]*$/;
const STORE_LABEL = { keychain: '키체인', wincred: '자격 증명 관리자', libsecret: 'libsecret', file: '파일' };

function configDir() {
  if (process.env.AIDURE_CONFIG_DIR) return process.env.AIDURE_CONFIG_DIR;
  if (process.platform === 'win32') return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'aidure');
  return path.join(os.homedir(), '.config', 'aidure');
}
const secretsDir = () => path.join(configDir(), 'secrets');
const indexFile = () => path.join(secretsDir(), 'index.json');

/** 프로젝트 범위 이름 = workspace.json project.name (없으면 null) */
function projectOf(root) {
  try { return JSON.parse(fs.readFileSync(path.join(root, 'workspace.json'), 'utf8')).project.name || null; } catch { return null; }
}

const has = (cmd, args = ['--help']) => { try { const r = spawnSync(cmd, args, { stdio: 'ignore', timeout: 5000 }); return !r.error; } catch { return false; } };
let detected = null;
/** 이 PC 의 OS 저장소 (없으면 file) */
function backend() {
  if (process.env.AIDURE_SECRETS_BACKEND) return process.env.AIDURE_SECRETS_BACKEND;
  if (detected) return detected;
  if (process.platform === 'darwin' && has('security', ['help'])) detected = 'keychain';
  else if (process.platform === 'win32' && has('powershell.exe', ['-NoProfile', '-Command', 'exit 0'])) detected = 'wincred';
  else if (process.platform === 'linux' && has('secret-tool', ['--version'])) detected = 'libsecret';
  else detected = 'file';
  return detected;
}

// ───────── 저장소별 ─────────

const q = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
const WINCRED_PS = `
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.Encoding]::UTF8
$in=[Console]::In.ReadToEnd()|ConvertFrom-Json
Add-Type -TypeDefinition @"
using System;using System.Runtime.InteropServices;using System.Text;
public static class AidureCred{
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] public struct CREDENTIAL{public int Flags;public int Type;public string TargetName;public string Comment;public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;public int CredentialBlobSize;public IntPtr CredentialBlob;public int Persist;public int AttributeCount;public IntPtr Attributes;public string TargetAlias;public string UserName;}
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool CredWrite(ref CREDENTIAL c,int flags);
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool CredRead(string target,int type,int flags,out IntPtr c);
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool CredDelete(string target,int type,int flags);
 [DllImport("advapi32.dll")] static extern void CredFree(IntPtr p);
 public static bool Write(string t,string v){var b=Encoding.UTF8.GetBytes(v);var c=new CREDENTIAL();c.Type=1;c.TargetName=t;c.UserName="aidure";c.Persist=2;c.CredentialBlobSize=b.Length;c.CredentialBlob=Marshal.AllocHGlobal(b.Length);Marshal.Copy(b,0,c.CredentialBlob,b.Length);try{return CredWrite(ref c,0);}finally{Marshal.FreeHGlobal(c.CredentialBlob);}}
 public static string Read(string t){IntPtr p;if(!CredRead(t,1,0,out p))return null;try{var c=(CREDENTIAL)Marshal.PtrToStructure(p,typeof(CREDENTIAL));var b=new byte[c.CredentialBlobSize];Marshal.Copy(c.CredentialBlob,b,0,b.Length);return Encoding.UTF8.GetString(b);}finally{CredFree(p);}}
 public static bool Delete(string t){return CredDelete(t,1,0);}
}
"@
switch($in.op){
 'put'{ if(-not [AidureCred]::Write($in.target,$in.value)){ exit 2 } }
 'get'{ $v=[AidureCred]::Read($in.target); if($v -eq $null){ exit 44 }; [Console]::Out.Write($v) }
 'del'{ [void][AidureCred]::Delete($in.target) }
}`;
const wincred = (op, target, value) => spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', WINCRED_PS],
  { input: JSON.stringify({ op, target, value }), encoding: 'utf8', timeout: 20000, stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });

const STORES = {
  keychain: {
    put: (scope, name, value) => spawnSync('security', ['-i'], { input: `add-generic-password -U -s ${q(`aidure:${scope}`)} -a ${q(name)} -l ${q(`aidure ${scope} ${name}`)} -X ${Buffer.from(value, 'utf8').toString('hex')}\n`, encoding: 'utf8', timeout: 15000, stdio: ['pipe', 'ignore', 'ignore'] }).status === 0,
    get: (scope, name) => {
      const r = spawnSync('security', ['find-generic-password', '-s', `aidure:${scope}`, '-a', name, '-g'], { encoding: 'utf8', timeout: 15000, stdio: ['ignore', 'ignore', 'pipe'] });
      if (r.status !== 0) return null;
      const line = (r.stderr.split('\n').find((l) => l.startsWith('password:')) || '').slice('password:'.length).trim();
      const hex = /^0x([0-9A-Fa-f]+)/.exec(line);
      if (hex) return Buffer.from(hex[1], 'hex').toString('utf8');
      const m = /^"([\s\S]*)"$/.exec(line);
      return m ? m[1] : null;
    },
    del: (scope, name) => spawnSync('security', ['delete-generic-password', '-s', `aidure:${scope}`, '-a', name], { stdio: 'ignore', timeout: 15000 }).status === 0,
  },
  libsecret: {
    put: (scope, name, value) => spawnSync('secret-tool', ['store', `--label=aidure ${scope} ${name}`, 'aidure-scope', scope, 'aidure-name', name], { input: value, timeout: 15000, stdio: ['pipe', 'ignore', 'ignore'] }).status === 0,
    get: (scope, name) => { const r = spawnSync('secret-tool', ['lookup', 'aidure-scope', scope, 'aidure-name', name], { encoding: 'utf8', timeout: 15000, stdio: ['ignore', 'pipe', 'ignore'] }); return r.status === 0 && r.stdout ? r.stdout.replace(/\n$/, '') : null; },
    del: (scope, name) => spawnSync('secret-tool', ['clear', 'aidure-scope', scope, 'aidure-name', name], { stdio: 'ignore', timeout: 15000 }).status === 0,
  },
  wincred: {
    put: (scope, name, value) => wincred('put', `aidure:${scope}:${name}`, value).status === 0,
    get: (scope, name) => { const r = wincred('get', `aidure:${scope}:${name}`); return r.status === 0 ? r.stdout : null; },
    del: (scope, name) => wincred('del', `aidure:${scope}:${name}`).status === 0,
  },
  file: {
    put: (scope, name, value) => { const f = scopeFile(scope); writeJson(f, { ...readJson(f), [name]: value }); return true; },
    get: (scope, name) => readJson(scopeFile(scope))[name] || null,
    del: (scope, name) => { const f = scopeFile(scope); const v = readJson(f); if (!(name in v)) return false; delete v[name]; writeJson(f, v); return true; },
  },
};

const scopeFile = (scope) => path.join(secretsDir(), `${scope}.json`);
function readJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; } }
/** KEY=값 줄 파일 (옛 telegram.env 읽기용) */
function readEnv(file) {
  const out = {};
  try {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*"?([^"\r]*?)"?\s*$/);
      if (m) out[m[1]] = m[2];
    }
  } catch { /* 없음 */ }
  return out;
}
/** 본인만 읽게: 폴더 700 · 파일 600, Windows 는 icacls 로 상속을 끊고 본인만 */
function lockDown(target) {
  if (process.platform === 'win32') {
    spawnSync('icacls', [target, '/inheritance:r', '/grant:r', `${process.env.USERNAME || os.userInfo().username}:F`], { stdio: 'ignore', windowsHide: true });
  } else { try { fs.chmodSync(target, fs.statSync(target).isDirectory() ? 0o700 : 0o600); } catch { /* 없음 */ } }
}
function writeJson(file, values) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  lockDown(path.dirname(file));
  const keep = Object.fromEntries(Object.entries(values).filter(([, v]) => v));
  if (!Object.keys(keep).length) { fs.rmSync(file, { force: true }); return; }
  fs.writeFileSync(file, `${JSON.stringify(keep, null, 2)}\n`, { mode: 0o600 });
  lockDown(file);
}
const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ───────── 목록 (값 없음) ─────────

function readIndex() { try { return JSON.parse(fs.readFileSync(indexFile(), 'utf8')); } catch { return {}; } }
function writeIndex(idx) {
  fs.mkdirSync(secretsDir(), { recursive: true, mode: 0o700 });
  lockDown(secretsDir());
  fs.writeFileSync(indexFile(), `${JSON.stringify(idx, null, 2)}\n`, { mode: 0o600 });
}
const key = (scope, name) => `${scope}/${name}`;
function updateMeta(scope, name, patch) {
  const idx = readIndex();
  if (patch === null) delete idx[key(scope, name)]; else idx[key(scope, name)] = { ...(idx[key(scope, name)] || {}), ...patch };
  writeIndex(idx);
}

// ───────── 옛 위치 ─────────

/** 킷이 예전에 쓰던 파일 (읽기만, 옮기는 것은 importLegacy) */
function legacySources() {
  const dir = configDir();
  const env = readEnv(path.join(dir, 'telegram.env'));
  const plain = (f) => { try { const v = fs.readFileSync(path.join(dir, f), 'utf8').trim(); return v && !v.includes('\n') ? v : null; } catch { return null; } };
  return [
    { name: 'TELEGRAM_BOT_TOKEN', file: path.join(dir, 'telegram.env'), value: env.TELEGRAM_BOT_TOKEN || null },
    { name: 'TELEGRAM_TEAM_BOT_TOKEN', file: path.join(dir, 'telegram.env'), value: env.TELEGRAM_TEAM_BOT_TOKEN || null },
    { name: 'GITLAB_TOKEN', file: path.join(dir, 'gitlab-token'), value: plain('gitlab-token') },
    { name: 'NPM_TOKEN', file: path.join(dir, 'ci-npm-token'), value: plain('ci-npm-token') },
  ].filter((x) => x.value);
}

// ───────── 바깥에서 쓰는 것 ─────────

const scopeLabel = (scope) => (scope === GLOBAL ? '전역' : `프로젝트(${scope})`);

/** 한 범위에서 읽기: 목록에 있는 저장소에서, 없으면 OS 저장소 · 파일 순 */
function readScope(scope, name) {
  if (!scope) return null;
  const meta = readIndex()[key(scope, name)];
  if (!meta) return null; // 목록에 없는 범위는 찾지 않는다 (훅이 저장소를 매번 부르지 않게)
  for (const st of [meta.store, 'file'].filter((x, i, a) => x && STORES[x] && a.indexOf(x) === i)) {
    try { const v = STORES[st].get(scope, name); if (v) return { value: v, store: st }; } catch { /* 다음 */ }
  }
  return null;
}

/**
 * 비밀값 읽기 → { value, source: 'env'|'project'|'global'|'legacy', scope?, store?, label } 또는 null
 * opts: { root | project, env = process.env, legacy = true }
 */
function get(name, opts = {}) {
  const env = opts.env || process.env;
  if (env[name]) return { value: env[name], source: 'env', label: '환경변수' };
  const project = opts.project || (opts.root ? projectOf(opts.root) : null);
  for (const [scope, source] of [[project, 'project'], [GLOBAL, 'global']]) {
    const r = readScope(scope, name);
    if (r) return { value: r.value, source, scope, store: r.store, label: `${scopeLabel(scope)} ${STORE_LABEL[r.store] || r.store}` };
  }
  if (opts.legacy !== false) {
    const l = legacySources().find((x) => x.name === name);
    if (l) return { value: l.value, source: 'legacy', file: l.file, label: `옛 파일 ${l.file} (aidure secret import 로 옮긴다)` };
  }
  return null;
}

/** 저장 → { store, fallback } (OS 저장소를 못 쓰면 파일에 두고 fallback=true). 값 검사: 이름 대문자 · 한 줄 */
function set(name, value, { scope }) {
  if (!NAME_RE.test(name)) throw new Error(`이름은 대문자 · 숫자 · _ 만 (예: GITLAB_TOKEN): ${name}`);
  const v = String(value == null ? '' : value).replace(/\r?\n$/, '');
  if (!v) throw new Error('값이 비었습니다');
  if (/[\r\n]/.test(v)) throw new Error('값은 한 줄이어야 합니다');
  if (!scope) throw new Error('범위가 없습니다 (워크스페이스 밖이면 --global)');
  let store = backend();
  let fallback = false;
  if (store !== 'file') {
    let ok = false;
    try { ok = STORES[store].put(scope, name, v) && STORES[store].get(scope, name) === v; } catch { ok = false; }
    if (!ok) { store = 'file'; fallback = true; }
  }
  if (store === 'file') STORES.file.put(scope, name, v);
  else STORES.file.del(scope, name); // 예전에 파일로 대체 저장한 값은 지운다
  updateMeta(scope, name, { store, savedAt: localDate(), test: null });
  return { store, fallback };
}

/** 지우기 → 지웠으면 true (모든 저장소에서) */
function rm(name, { scope }) {
  let any = false;
  for (const st of [...new Set([backend(), 'file'])]) { try { any = STORES[st].del(scope, name) || any; } catch { /* 없음 */ } }
  const had = !!readIndex()[key(scope, name)];
  updateMeta(scope, name, null);
  return any || had;
}

/** 목록 행 (값 없음): [{ name, scope, store, savedAt, test }] */
function list() {
  return Object.entries(readIndex()).map(([k, m]) => { const i = k.indexOf('/'); return { scope: k.slice(0, i), name: k.slice(i + 1), ...m }; })
    .sort((a, b) => a.name.localeCompare(b.name) || a.scope.localeCompare(b.scope));
}

function recordTest(scope, name, test) { if (scope && readIndex()[key(scope, name)]) updateMeta(scope, name, { test }); }

/** 팩이 선언한 비밀값 [{ name, scope, purpose, needs, test, pack }] (pack.json "secrets") */
function declared(root, packs) {
  const out = [];
  for (const p of packs || []) {
    let meta = {};
    try { meta = JSON.parse(fs.readFileSync(path.join(root, 'packs', p, 'pack.json'), 'utf8')); } catch { continue; }
    for (const s of meta.secrets || []) if (s && NAME_RE.test(s.name) && !out.some((x) => x.name === s.name)) out.push({ scope: 'project', needs: [], ...s, pack: p });
  }
  return out;
}

/** 하위 프로세스에 넘기지 않을 이름 (선언 · 목록 · 옛 위치 · 알려진 이름) */
function knownNames(root, packs) {
  return [...new Set(['TELEGRAM_BOT_TOKEN', 'TELEGRAM_TEAM_BOT_TOKEN', 'GITLAB_TOKEN', 'GITHUB_TOKEN', 'NPM_TOKEN',
    ...declared(root, packs).map((x) => x.name), ...list().map((x) => x.name), ...legacySources().map((x) => x.name)])];
}

/** 하위 프로세스 환경에서 비밀값 이름을 모두 뺀다 (env 를 고쳐 돌려준다). extra = 더 뺄 이름 (예: vars.gitlab.tokenEnv) */
function scrubEnv(env, root, packs, extra = []) {
  for (const n of [...knownNames(root, packs), ...extra.filter(Boolean)]) delete env[n];
  return env;
}

/**
 * 토큰을 보낼 GitLab API 주소. apiBase 는 gitlab.host 와 같은 호스트의 https 일 때만 받는다 (공유 workspace.json 한 줄로 토큰이 다른 서버로 가지 않게).
 * 받을 수 없으면 null
 */
function gitlabApi(host, apiBase) {
  const h = String(host || '').toLowerCase();
  if (!apiBase) return h ? `https://${h}/api/v4` : null;
  try {
    const u = new URL(apiBase), local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(u.hostname);   /* http 는 이 PC 안(시험 · 터널)만 */
    return (u.protocol === 'https:' || (u.protocol === 'http:' && local)) && h && u.host.toLowerCase() === h ? String(apiBase).replace(/\/$/, '') : null;
  } catch { return null; }
}
const httpsOnly = (url) => { try { return new URL(url).protocol === 'https:'; } catch { return false; } };

/** 유효성 확인 (네트워크). kind: gitlab | telegram | npm. → { ok, info: { user?, name?, scopes?, expires? }, error? } — 값은 결과에 넣지 않는다 */
async function test(kind, value, ctx = {}) {
  const t = (ms) => AbortSignal.timeout(ms || 8000);
  try {
    if (kind === 'gitlab') {
      const base = String(ctx.gitlabApi || (ctx.gitlabHost ? `https://${ctx.gitlabHost}/api/v4` : '')).replace(/\/$/, '');
      if (!base) return { ok: false, error: 'GitLab 주소를 모릅니다 (workspace.json repos 의 gitlab.host · remote)' };
      const r = await fetch(`${base}/personal_access_tokens/self`, { headers: { 'PRIVATE-TOKEN': value }, signal: t() });
      if (r.status === 401) return { ok: false, error: '401: 토큰이 아니거나 만료 · 취소됨 (git 계정 비밀번호는 API 에 쓸 수 없다)' };
      if (!r.ok) return { ok: false, error: `${r.status} ${r.statusText}` };
      const j = await r.json();
      return { ok: j.active !== false && !j.revoked, info: { name: j.name, scopes: j.scopes || [], expires: j.expires_at || null }, ...(j.revoked ? { error: '취소된 토큰' } : {}) };
    }
    if (kind === 'telegram') {
      const r = await fetch(`${process.env.AIDURE_TELEGRAM_API || 'https://api.telegram.org'}/bot${value}/getMe`, { signal: t() });
      const j = await r.json().catch(() => ({}));
      return j.ok ? { ok: true, info: { user: `@${j.result.username}` } } : { ok: false, error: j.description || `${r.status}` };
    }
    if (kind === 'npm') {
      const reg = String(ctx.npmRegistry || 'https://registry.npmjs.org').replace(/\/$/, '');
      if (!httpsOnly(reg)) return { ok: false, error: `https 가 아닌 레지스트리로는 토큰을 보내지 않습니다: ${reg}` };
      const r = await fetch(`${reg}/-/whoami`, { headers: { authorization: `Bearer ${value}` }, signal: t() });
      const j = await r.json().catch(() => ({}));
      return r.ok && j.username ? { ok: true, info: { user: j.username } } : { ok: false, error: `${r.status} ${j.error || r.statusText}` };
    }
    return { ok: false, error: `확인 방법이 없는 종류: ${kind || '(없음)'}` };
  } catch (e) { return { ok: false, error: e.name === 'TimeoutError' ? '시간 초과' : e.message }; }
}

/** 확인 결과의 경고 문장 (권한 부족 · 만료 임박) */
function testWarnings(res, needs = [], today = new Date()) {
  const out = [];
  if (!res || !res.ok) return out;
  const scopes = (res.info && res.info.scopes) || null;
  if (scopes && needs.length) {
    const miss = needs.filter((n) => !scopes.includes(n) && !(n === 'read_api' && scopes.includes('api')));
    if (miss.length) out.push(`권한 부족: ${miss.join(', ')} 필요 (지금 ${scopes.join(', ') || '없음'})`);
  }
  const exp = res.info && res.info.expires;
  if (exp) {
    const days = Math.round((new Date(exp) - today) / 86400000);
    if (days < 0) out.push(`만료됨 (${exp})`); else if (days <= 30) out.push(`만료 ${days}일 전 (${exp})`);
  }
  return out;
}

/** 확인 결과 한 줄 (값 없음). mark = false 면 앞의 ✔ · ✖ 없이 */
function testLine(res, today = new Date(), mark = true) {
  if (!res) return '확인 안 함';
  if (!res.ok) return `${mark ? '✖ ' : ''}${res.error || '실패'}`;
  const i = res.info || {};
  const days = i.expires ? Math.round((new Date(i.expires) - today) / 86400000) : null;
  return [mark && '✔', i.user, i.name && `토큰 「${i.name}」`, i.scopes && `권한 ${i.scopes.join(', ')}`, i.expires && `만료 ${i.expires} (${days}일)`].filter(Boolean).join(' · ');
}

/** 숨김 입력 (터미널) 또는 표준 입력 한 줄. 값은 화면에 찍지 않는다. 터미널이 아니고 표준 입력도 비었으면 '' */
function readHidden(prompt) {
  if (!process.stdin.isTTY) {
    try { return Promise.resolve(fs.readFileSync(0, 'utf8').split(/\r?\n/)[0]); } catch { return Promise.resolve(''); }
  }
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let buf = '';
    const done = (v) => { stdin.setRawMode(false); stdin.pause(); stdin.removeListener('data', onData); process.stdout.write('\n'); resolve(v); };
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') return done(buf);
        if (ch === '\u0003') { process.stdout.write('\n'); process.exit(130); }
        if (ch === '\u007f' || ch === '\b') buf = buf.slice(0, -1); else if (ch >= ' ') buf += ch;
      }
    };
    stdin.on('data', onData);
  });
}

module.exports = { gitlabApi, readHidden, localDate, GLOBAL, NAME_RE, STORE_LABEL, configDir, secretsDir, projectOf, backend, get, set, rm, list, recordTest, declared, knownNames, scrubEnv, legacySources, readEnv, test, testWarnings, testLine, scopeLabel, STORES };
