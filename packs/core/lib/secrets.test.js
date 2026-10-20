// secrets.js · bin/secret.js 점검 (파일 저장소 · 임시 설정 폴더): 찾는 순서 · 프로젝트 분리 · 출력에 값 없음 · 옛 위치 옮기기 · 위임 환경 · 확인. 실행: node secrets.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawnSync } = require('child_process');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aikit-secrets-'));
process.env.AIKIT_CONFIG_DIR = path.join(tmp, 'config');
process.env.AIKIT_SECRETS_BACKEND = 'file';
for (const k of ['GITLAB_TOKEN', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_TEAM_BOT_TOKEN', 'NPM_TOKEN']) delete process.env[k];
const S = require('./secrets');
const PACKS = path.resolve(__dirname, '..', '..');

// 찾는 순서: 환경변수 > 프로젝트 > 전역 > 옛 파일. 두 프로젝트는 서로 다른 값, 전역은 둘 다 대체로
const A = 'glpat-project-a-0001';
const B = 'glpat-project-b-0002';
const G = 'glpat-global-0003';
S.set('GITLAB_TOKEN', A, { scope: 'alpha' });
S.set('GITLAB_TOKEN', B, { scope: 'beta' });
S.set('GITLAB_TOKEN', G, { scope: S.GLOBAL });
assert.strictEqual(S.get('GITLAB_TOKEN', { project: 'alpha' }).value, A);
assert.strictEqual(S.get('GITLAB_TOKEN', { project: 'beta' }).value, B);
assert.strictEqual(S.get('GITLAB_TOKEN', { project: 'gamma' }).value, G, '프로젝트에 없으면 전역');
assert.strictEqual(S.get('GITLAB_TOKEN', { project: 'gamma' }).source, 'global');
assert.strictEqual(S.get('GITLAB_TOKEN', { project: 'alpha', env: { GITLAB_TOKEN: 'from-env' } }).value, 'from-env', '환경변수가 먼저');
assert.strictEqual(S.get('GITLAB_TOKEN', { project: 'alpha' }).label, '프로젝트(alpha) 파일');
S.rm('GITLAB_TOKEN', { scope: S.GLOBAL });
fs.mkdirSync(process.env.AIKIT_CONFIG_DIR, { recursive: true });
fs.writeFileSync(path.join(process.env.AIKIT_CONFIG_DIR, 'gitlab-token'), 'glpat-legacy-0004\n');
const leg = S.get('GITLAB_TOKEN', { project: 'gamma' });
assert.deepStrictEqual([leg.value, leg.source], ['glpat-legacy-0004', 'legacy'], '전역도 없으면 옛 파일');
assert.strictEqual(S.get('GITLAB_TOKEN', { project: 'gamma', legacy: false }), null);
// 저장 파일은 본인만, 목록에는 값이 없다
const idx = fs.readFileSync(path.join(S.secretsDir(), 'index.json'), 'utf8');
assert.ok(![A, B, G].some((v) => idx.includes(v)), '목록에 값 없음');
if (process.platform !== 'win32') assert.strictEqual(fs.statSync(path.join(S.secretsDir(), 'alpha.json')).mode & 0o777, 0o600);
// 값 검사: 이름 대문자 · 한 줄
assert.throws(() => S.set('gitlab', 'x', { scope: 'alpha' }), /대문자/);
assert.throws(() => S.set('X_TOKEN', 'a\nb', { scope: 'alpha' }), /한 줄/);

// 확인 결과 경고: 권한 부족 · 만료 임박 (api 가 있으면 read_api 도 된다)
const today = new Date('2026-10-12');
assert.deepStrictEqual(S.testWarnings({ ok: true, info: { scopes: ['read_api'], expires: '2026-10-30' } }, ['api'], today), ['권한 부족: api 필요 (지금 read_api)', '만료 18일 전 (2026-10-30)']);
assert.deepStrictEqual(S.testWarnings({ ok: true, info: { scopes: ['api'], expires: '2027-10-01' } }, ['read_api'], today), []);

// 위임 환경: 선언 · 목록 · 옛 위치 이름을 모두 뺀다
const ws = path.join(tmp, 'ws');
fs.mkdirSync(path.join(ws, 'packs'), { recursive: true });
for (const p of ['core', 'gitlab']) fs.symlinkSync(path.join(PACKS, p), path.join(ws, 'packs', p), 'dir');
fs.writeFileSync(path.join(ws, 'workspace.json'), JSON.stringify({ project: { name: 'alpha' }, packs: ['core', 'gitlab', 'project'], repos: [] }));
const env = S.scrubEnv({ PATH: '/bin', GITLAB_TOKEN: 'x', TELEGRAM_TEAM_BOT_TOKEN: 'y', MY_TOKEN_ENV: 'z', OTHER: '1' }, ws, ['core', 'gitlab'], ['MY_TOKEN_ENV']);
assert.deepStrictEqual(Object.keys(env).sort(), ['OTHER', 'PATH']);
assert.deepStrictEqual(S.declared(ws, ['core', 'gitlab']).map((d) => `${d.name}:${d.scope}`), ['TELEGRAM_BOT_TOKEN:global', 'TELEGRAM_TEAM_BOT_TOKEN:global', 'GITLAB_TOKEN:project']);

// 명령: 값은 인자로 안 받고, 어떤 출력에도 없다
const cli = (args, input) => spawnSync(process.execPath, [path.join(PACKS, 'core', 'bin', 'secret.js'), ...args], { cwd: ws, input: input || '', encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: ws } });
const SECRET = 'glpat-cli-secret-0005';
const outs = [];
const keep = (r) => { outs.push(r.stdout + r.stderr); return r; };
assert.strictEqual(keep(cli(['set', 'GITLAB_TOKEN', SECRET])).status, 1, '값을 인자로 주면 거부');
assert.strictEqual(keep(cli(['set', 'GITLAB_TOKEN', '--no-test'], `${SECRET}\n`)).status, 0);
assert.strictEqual(S.get('GITLAB_TOKEN', { project: 'alpha' }).value, SECRET, '표준 입력으로 넣는다');
const listed = keep(cli(['list'])).stdout;
assert.match(listed, /GITLAB_TOKEN {2}\(gitlab 팩: MR 생성 · 파이프라인 조회 · 권한 api\)\n {2}지금 읽는 곳: 프로젝트\(alpha\) 파일/);
const ex = keep(cli(['exec', '--only', 'GITLAB_TOKEN', '--', process.execPath, '-e', 'process.exit(process.env.GITLAB_TOKEN === process.argv[1] ? 0 : 3)', SECRET]));
assert.strictEqual(ex.status, 0, 'exec 는 그 명령에만 넣는다');
assert.match(ex.stderr, /GITLAB_TOKEN ← 프로젝트\(alpha\) 파일/);
keep(cli(['rm', 'GITLAB_TOKEN']));
assert.strictEqual(S.get('GITLAB_TOKEN', { project: 'alpha', legacy: false }), null);
assert.ok(!outs.slice(1).some((o) => o.includes(SECRET)), '출력에 값 없음');

// 옮기기: telegram.env 는 토큰 줄만 빼고(채팅 ID 유지) 사본을 남기고, gitlab-token 은 *.migrated
const cfg = process.env.AIKIT_CONFIG_DIR;
fs.writeFileSync(path.join(cfg, 'telegram.env'), 'TELEGRAM_BOT_TOKEN=123:tele-0006\nTELEGRAM_CHAT_ID=42\n');
const imp = keep(cli(['import', '--global']));
assert.strictEqual(imp.status, 0, imp.stderr);
assert.strictEqual(S.get('TELEGRAM_BOT_TOKEN', { legacy: false }).value, '123:tele-0006');
assert.strictEqual(S.get('GITLAB_TOKEN', { project: 'zeta', legacy: false }).value, 'glpat-legacy-0004');
assert.strictEqual(fs.readFileSync(path.join(cfg, 'telegram.env'), 'utf8').trim(), 'TELEGRAM_CHAT_ID=42');
assert.ok(fs.existsSync(path.join(cfg, 'telegram.env.migrated')) && fs.existsSync(path.join(cfg, 'gitlab-token.migrated')) && !fs.existsSync(path.join(cfg, 'gitlab-token')));
assert.ok(!imp.stdout.includes('tele-0006') && !imp.stdout.includes('legacy-0004'));

// 알림이 저장소의 봇 토큰을 읽는다 (telegram.env 에서 옮긴 뒤에도 그대로 동작)
const notify = require('./notify');
assert.strictEqual(notify.personal(ws, { project: { name: 'alpha' } }).token, '123:tele-0006');
// 옮긴 뒤 봇을 바꾸면(aikit notify my setup) 저장소를 고친다 · 지우면 저장소에서도 지운다
notify.writeSecrets({ TELEGRAM_BOT_TOKEN: '456:tele-0007' });
assert.strictEqual(notify.personal(ws, { project: { name: 'alpha' } }).token, '456:tele-0007');
assert.ok(!fs.readFileSync(path.join(cfg, 'telegram.env'), 'utf8').includes('tele-0007'), '파일에는 쓰지 않는다');
notify.writeSecrets({ TELEGRAM_BOT_TOKEN: '', TELEGRAM_CHAT_ID: '' });
assert.strictEqual(S.get('TELEGRAM_BOT_TOKEN', { legacy: false }), null);

// 확인(네트워크): GitLab 토큰 이름 · 권한 · 만료, 401 은 git 비밀번호 안내, 텔레그램 봇 이름
(async () => {
  const server = http.createServer((req, res) => {
    if (req.url === '/api/v4/personal_access_tokens/self') {
      if (req.headers['private-token'] !== 'good') { res.writeHead(401); return res.end('{}'); }
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ name: 'aikit', scopes: ['api'], expires_at: '2027-01-01', active: true, revoked: false }));
    }
    if (req.url === '/botT/getMe') { res.writeHead(200); return res.end(JSON.stringify({ ok: true, result: { username: 'my_bot' } })); }
    res.writeHead(404); res.end('{}');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const ok = await S.test('gitlab', 'good', { gitlabApi: `${base}/api/v4` });
  assert.deepStrictEqual(ok, { ok: true, info: { name: 'aikit', scopes: ['api'], expires: '2027-01-01' } });
  assert.match(S.testLine(ok, today), /^✔ · 토큰 「aikit」 · 권한 api · 만료 2027-01-01 \(81일\)$/);
  const bad = await S.test('gitlab', 'bad', { gitlabApi: `${base}/api/v4` });
  assert.ok(!bad.ok && /git 계정 비밀번호는 API 에 쓸 수 없다/.test(bad.error));
  process.env.AIKIT_TELEGRAM_API = base;
  assert.deepStrictEqual(await S.test('telegram', 'T'), { ok: true, info: { user: '@my_bot' } });
  // 토큰을 보낼 GitLab API: gitlab.host 와 같은 호스트의 https 만 (http 는 이 PC 안만)
  assert.strictEqual(S.gitlabApi('git.co', ''), 'https://git.co/api/v4');
  assert.strictEqual(S.gitlabApi('git.co', 'https://git.co/api/v4/'), 'https://git.co/api/v4');
  assert.strictEqual(S.gitlabApi('git.co', 'https://evil.example/api/v4'), null);
  assert.strictEqual(S.gitlabApi('git.co', 'http://git.co/api/v4'), null);
  assert.strictEqual(S.gitlabApi('127.0.0.1:9', 'http://127.0.0.1:9/api/v4'), 'http://127.0.0.1:9/api/v4');
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('secrets.test.js ✔');
})().catch((e) => { console.error(e); process.exit(1); });
