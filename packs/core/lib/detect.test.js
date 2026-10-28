// detect.js 점검 — 간접 의존(사내 라이브러리가 프레임워크를 끌어오는 경우) 감지와 stackHints. 실행: node detect.test.js
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { detect, loadCatalog, withHints, checkHints, buildFiles } = require('./detect');

const catalog = loadCatalog(path.resolve(__dirname, '..', '..', '..'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kedovi-detect-'));
const repo = (name, files) => {
  const dir = path.join(tmp, name);
  for (const [f, body] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), body); }
  return dir;
};
const ids = (dir, cat = catalog) => detect(dir, cat).map((f) => f.id);
// 빌드 파일에 프레임워크 이름이 없다 — 사내 스타터만
const gradle = "dependencies { implementation 'com.example.platform:platform-starter:2.1.0' }\n";
const cases = [];
const it = (name, fn) => cases.push([name, fn]);

it('설정 파일의 spring 키로 간접 의존을 잡는다', () => {
  const d = repo('via-config', { 'build.gradle': gradle, 'src/main/resources/application.yml': 'spring:\n  application:\n    name: api\n' });
  assert.deepStrictEqual(ids(d), ['spring']);
});
it('멀티 모듈의 프로필 properties 도 잡는다', () => {
  const d = repo('via-profile', { 'settings.gradle': "include 'api'\n", 'api/build.gradle': gradle, 'api/src/main/resources/application-local.properties': 'spring.datasource.url=jdbc:h2:mem:x\n' });
  assert.deepStrictEqual(ids(d), ['spring']);
});
it('깊은 소스의 @SpringBootApplication 을 잡는다', () => {
  const d = repo('via-source', { 'pom.xml': '<project><artifactId>x</artifactId></project>', 'app/src/main/java/com/example/shop/api/ShopApplication.java': '@SpringBootApplication\npublic class ShopApplication {}\n' });
  assert.deepStrictEqual(ids(d), ['spring']);
});
it('다른 프레임워크 설정 파일은 Spring 으로 보지 않는다', () => {
  const d = repo('micronaut', { 'build.gradle': gradle, 'src/main/resources/application.yml': 'micronaut:\n  application:\n    name: api\n  spring: {}\n' });
  assert.deepStrictEqual(ids(d), []);
});
const mods = (dir) => Object.fromEntries(detect(dir, catalog).map((f) => [f.id, f.modules || null]));
it('멀티모듈 repo 는 스택마다 모듈 경로를 준다', () => {
  const d = repo('mono', { 'settings.gradle': "include 'api'\n", 'build.gradle': "plugins { id 'org.springframework.boot' version '3.5.5' apply false }\n",
    'api/build.gradle': "plugins { id 'org.springframework.boot' version '3.5.5' }\n", 'api/src/main/resources/application.yml': 'spring.datasource.url: jdbc:postgresql://db/x\n',
    'client/package.json': '{"dependencies":{"react":"^19"}}', 'admin/package.json': '{"dependencies":{"react":"^19"}}' });
  assert.deepStrictEqual(mods(d), { spring: ['api'], react: ['admin', 'client'], postgres: ['api'] });
});
it('한 모듈짜리 repo 는 모듈 경로가 없다', () => {
  const d = repo('single', { 'build.gradle': "plugins { id 'org.springframework.boot' version '3.5.5' }\n", 'src/main/resources/application.yml': 'spring.datasource.url: jdbc:postgresql://db/x\n' });
  assert.deepStrictEqual(mods(d), { spring: null, postgres: null });
});
it('빌드 파일이 없으면 근거 파일 폴더가 아니라 repo 전체로 본다', () => {
  const d = repo('no-build', { 'wear/src/main/AndroidManifest.xml': '<manifest><uses-feature android:name="android.hardware.type.watch"/></manifest>' });
  assert.deepStrictEqual(mods(d), { android: null, wearos: null });
});
it('못 잡으면 빌드 파일을 알려 주고, 힌트를 적으면 잡는다', () => {
  const d = repo('via-hint', { 'build.gradle': gradle });
  assert.deepStrictEqual(ids(d), []);
  assert.deepStrictEqual(buildFiles(d), ['build.gradle']);
  const found = detect(d, withHints(catalog, [{ stack: 'spring', contains: 'com\\.example\\.platform:platform-starter' }]));
  assert.deepStrictEqual(found, [{ id: 'spring', evidence: 'build.gradle (힌트)' }]);
});
it('힌트 files 를 주면 그 파일만 본다', () => {
  const d = repo('hint-files', { 'deps.lock': 'com.example.platform:platform-starter\n', 'build.gradle': gradle.replace('platform-starter', 'other') });
  assert.deepStrictEqual(ids(d, withHints(catalog, [{ stack: 'spring', contains: 'platform-starter', files: ['deps.lock'] }])), ['spring']);
});
it('힌트가 없거나 비면 목록을 그대로 쓴다', () => {
  assert.strictEqual(withHints(catalog, undefined), catalog);
  assert.strictEqual(withHints(catalog, []), catalog);
});
it('잘못된 힌트는 오류로 알린다', () => {
  assert.deepStrictEqual(checkHints(catalog, undefined), []);
  assert.strictEqual(checkHints(catalog, {}).length, 1);
  const errs = checkHints(catalog, [{ stack: 'no-such', contains: 'x' }, { stack: 'spring', contains: '(' }, { stack: 'spring' }]);
  assert.strictEqual(errs.length, 3);
  assert.match(errs[0], /모르는 스택/);
  assert.match(errs[1], /정규식/);
});

it('인프라: 배포 파일은 잡고 개발 컨테이너 · 시험 자료 · 소문자 kind 는 뺀다', () => {
  const ok = repo('infra-ok', { Dockerfile: 'FROM x\n', 'compose.yaml': 'services:\n  a:\n    image: x\n', 'deploy/app.yaml': 'kind: Deployment\n', 'chart/Chart.yaml': 'apiVersion: v2\n', 'tf/main.tf': 'terraform {}\n', 'ops/site.yml': '- hosts: web\n' });
  assert.deepStrictEqual(ids(ok), ['docker', 'docker-compose', 'kubernetes', 'helm', 'terraform', 'ansible']);
  const no = repo('infra-no', { '.devcontainer/Dockerfile': 'FROM x\n', 'src/test/resources/k8s/job.yaml': 'kind: Job\n', 'conf/app.yml': 'kind: job\n', 'tests/site.yml': '- hosts: x\n', 'k8s/ing.yaml': 'spec:\n  tls:\n    - hosts:\n        - x\n', 'docker-compose.yml': 'version: "3"\n' });
  assert.deepStrictEqual(ids(no), []);
});

let failed = 0;
for (const [name, fn] of cases) {
  try { fn(); console.log(`✔ ${name}`); } catch (e) { failed++; console.log(`✖ ${name}\n  ${e.message}`); }
}
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
