// cli.js 점검 — PATH 에 없는 Codex 앱 CLI 찾기. 실행: node cli.test.js
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { codexAppCli } = require('./cli');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aikit-cli-'));
const exe = process.platform === 'win32' ? '.exe' : '';
// Codex 앱 배치: packages/<이름>/current → releases/<버전>, 그 안 codex-package.json 의 entrypoint
const release = (home, ver, manifest = true) => {
  const dir = path.join(home, 'packages', 'app-server-daemon', 'releases', ver);
  fs.mkdirSync(path.join(dir, 'bin'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'bin', `codex${exe}`), '');
  if (manifest) fs.writeFileSync(path.join(dir, 'codex-package.json'), JSON.stringify({ entrypoint: 'bin/codex' }));
  return dir;
};
const point = (home, dir) => {
  const cur = path.join(home, 'packages', 'app-server-daemon', 'current');
  fs.rmSync(cur, { force: true });
  fs.symlinkSync(dir, cur, 'junction');
};
const cases = [];
const it = (name, fn) => cases.push([name, fn]);

it('current 가 가리키는 버전의 CLI 를 찾는다', () => {
  const home = path.join(tmp, 'a');
  release(home, '0.158.0');
  point(home, release(home, '0.159.0'));
  assert.strictEqual(codexAppCli({ CODEX_HOME: home }), path.join(home, 'packages', 'app-server-daemon', 'current', 'bin', `codex${exe}`));
  assert.ok(fs.realpathSync(codexAppCli({ CODEX_HOME: home })).includes('0.159.0'));
});
it('codex-package.json 이 없으면 bin/codex 를 본다', () => {
  const home = path.join(tmp, 'b');
  point(home, release(home, '1.0.0', false));
  assert.ok(codexAppCli({ CODEX_HOME: home }));
});
it('Codex 앱이 없으면 null', () => {
  assert.strictEqual(codexAppCli({ CODEX_HOME: path.join(tmp, 'none') }), null);
  const home = path.join(tmp, 'c');
  release(home, '1.0.0'); // current 링크 없음 — 설치 중이거나 깨진 상태
  assert.strictEqual(codexAppCli({ CODEX_HOME: home }), null);
});

let failed = 0;
for (const [name, fn] of cases) {
  try { fn(); console.log(`✔ ${name}`); } catch (e) { failed++; console.log(`✖ ${name}\n  ${e.message}`); }
}
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
