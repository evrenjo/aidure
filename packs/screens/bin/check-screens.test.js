// check-screens.js · docs-site.js 점검: 장 읽기 · 줄여 쓴 번호 · 임시 기획 repo 에서 만들기 → 어긋남 → 검사. 실행: node check-screens.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { screensOf, idsIn, noScreenIds, descIssues } = require('./check-screens');

assert.deepStrictEqual([...noScreenIds({ 'a.html': '<table><tr id="SCR-001"><td>SCR-001</td><td>FN-001</td></tr><tr><td>화면 없음 (배치 작업)</td><td>FN-002 · FN-003</td></tr></table>' })], ['FN-002', 'FN-003'], '「화면 없음」 행의 기능만');
assert.deepStrictEqual([...noScreenIds({ 'a.html': '<table><tr><td>다음 스프린트</td><td>FN-004 · FN-005</td></tr></table>' })], ['FN-004', 'FN-005'], '「다음 스프린트」 행의 기능도 세지 않는다');
assert.deepStrictEqual(idsIn('근거: VS-ADM-04 · 05 · 7, FN-001'), ['VS-ADM-04', 'VS-ADM-05', 'FN-001'], '자릿수가 다른 번호는 잇지 않는다');
const tpl = fs.readFileSync(path.join(__dirname, '..', 'assets', 'storyboard', 'template.html'), 'utf8');
const sheets = screensOf(tpl);
assert.deepStrictEqual(sheets.map((s) => s.id), ['cover', 'history', 'menu', 'policy', 'SCR-000'], '견본 5장');
assert.deepStrictEqual(sheets.filter((s) => s.isScreen).map((s) => s.id), ['SCR-000'], '화면 장은 메타 표가 있는 장');
assert.ok(!/—/.test(tpl), '견본에 장식용 대시 없음');
assert.deepStrictEqual(sheets.find((s) => s.id === 'SCR-000').desc.filter((t) => descIssues(t).length), [], '견본 설명은 결론 한 줄');
assert.deepStrictEqual(descIssues('시장 띠: 지수 카드 3개(코스피 · 코스닥 · 선물, 선물은 2026-10-16 사용자 결정으로 추가)'), ['날짜', '결정 경위']);
assert.deepStrictEqual(descIssues('가'.repeat(61)), ['60자 넘음']);
assert.deepStrictEqual(descIssues('보유 종목 카드: 계좌별 보유 종목과 비중'), []);

// 임시 기획 repo
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aidure-screens-'));
const put = (f, c) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), c); };
put('README.md', '# 기획\n');
put('40-functions.md', '# 기능정의\n\n### FN-001 로그인\n\n본문\n\n### FN-002 목록\n\n본문\n');
put('02-screens/README.md', '# 화면 목록\n\n| 화면 ID | 화면 | 기능 ID |\n|---|---|---|\n| SCR-001 | 로그인 | FN-001 |\n| SCR-002 | 목록 | FN-002 |\n');
const sheet = (id, rel, refs) => `<section class="sheet" id="${id}" data-group="g" data-label="${id}"><table class="meta screen-meta"><tr><th>Related ID</th><td>${rel}</td></tr></table><aside class="side"><div class="refs">근거: ${refs}</div></aside></section>`;
put('02-screens/web.html', `<!doctype html><html><head><link rel="stylesheet" href="storyboard.css"></head><body>${sheet('SCR-001', 'FN-001', 'FN-001 · FN-404')}<script src="storyboard.js"></script></body></html>`);
const node = (args) => spawnSync(process.execPath, args, { cwd: dir, encoding: 'utf8' });
const site = path.join(__dirname, '..', '..', 'core', 'bin', 'docs-site.js');
const check = path.join(__dirname, 'check-screens.js');

let r = node([check, dir]);
assert.strictEqual(r.status, 1, '없는 근거 ID 는 ✖');
assert.match(r.stdout, /FN-404 가 색인에 없습니다/);
assert.match(r.stdout, /화면 목록에 있는데 장이 없음: SCR-002/);
// 한 쪽을 넘어 나눈 장(data-continues)은 화면 목록 대조에서 빼고, 근거 ID 는 그대로 본다. 원래 화면이 없으면 ✖
const webHtml = fs.readFileSync(path.join(dir, '02-screens/web.html'), 'utf8');
const contSheet = (id, of, refs) => sheet(id, '', refs).replace(`id="${id}"`, `id="${id}" data-continues="${of}"`);
put('02-screens/web.html', `<body>${sheet('SCR-001', 'FN-001', 'FN-001')}${contSheet('SCR-001-2', 'SCR-001', 'FN-001')}${sheet('SCR-002', 'FN-002', 'FN-002')}</body>`);
r = node([check, dir]);
assert.strictEqual(r.status, 0, r.stdout);
assert.doesNotMatch(r.stdout, /목록에 없음|Related ID 가 비었습니다/, r.stdout);
put('02-screens/web.html', `<body>${sheet('SCR-001', 'FN-001', 'FN-001')}${contSheet('SCR-001-2', 'SCR-009', 'FN-405')}${sheet('SCR-002', 'FN-002', 'FN-002')}</body>`);
r = node([check, dir]);
assert.strictEqual(r.status, 1);
assert.match(r.stdout, /data-continues="SCR-009" 인 화면 장이 없습니다/);
assert.match(r.stdout, /SCR-001-2: FN-405 가 색인에 없습니다/);
put('02-screens/web.html', webHtml);

r = node([site, 'check', dir]);
assert.strictEqual(r.status, 0);
assert.match(r.stdout, /만든 적 없음/);
r = node([site, 'build', dir]);
assert.strictEqual(r.status, 0, r.stderr);
for (const f of ['index.html', '40-functions.html', '02-screens/web.html', '02-screens/index.html', 'assets/ids.json', 'assets/site.json', 'assets/site.css', 'assets/storyboard/storyboard.js']) assert.ok(fs.existsSync(path.join(dir, 'docs-site', f)), f);
assert.match(fs.readFileSync(path.join(dir, 'docs-site', '02-screens', 'web.html'), 'utf8'), /href="..\/assets\/storyboard\/storyboard.css\?v=[0-9a-f]{8}"/);
// 뷰어: 화면 라이브러리(assets/vendor.js) 다음에 storyboard.js (src/*.js 를 이은 Preact 앱)
assert.match(fs.readFileSync(path.join(dir, 'docs-site', '02-screens', 'web.html'), 'utf8'), /<script src="..\/assets\/vendor.js\?v=[0-9a-f]{8}"><\/script>\n<script src="..\/assets\/storyboard\/storyboard.js\?v=[0-9a-f]{8}">/);
assert.ok(fs.existsSync(path.join(dir, 'docs-site', 'assets', 'vendor.js')), 'assets/vendor.js');
assert.ok(/function Thumb\(/.test(fs.readFileSync(path.join(dir, 'docs-site', 'assets', 'storyboard', 'storyboard.js'), 'utf8')), '뷰어 앱');
assert.strictEqual(node([site, 'hook', dir]).status, 0, '만든 직후는 같다');
fs.appendFileSync(path.join(dir, '40-functions.md'), '\n추가\n');
r = node([site, 'hook', dir]);
assert.strictEqual(r.status, 1, 'md 만 고치면 막는다');
assert.match(r.stdout, /~ 40-functions.html/);
node([site, 'build', dir]);
assert.strictEqual(node([site, 'hook', dir]).status, 0);
// 지운 md 의 페이지는 다음 build 가 지운다 · 다른 생성기의 docs-site/ 는 덮지 않는다
fs.rmSync(path.join(dir, '40-functions.md'));
node([site, 'build', dir]);
assert.ok(!fs.existsSync(path.join(dir, 'docs-site', '40-functions.html')));
const other = fs.mkdtempSync(path.join(os.tmpdir(), 'aidure-screens-other-'));
fs.mkdirSync(path.join(other, 'docs-site'));
fs.writeFileSync(path.join(other, 'docs-site', 'index.html'), 'hand made');
fs.writeFileSync(path.join(other, 'a.md'), '# A\n');
r = node([site, 'build', other]);
assert.strictEqual(r.status, 1);
assert.match(r.stderr, /덮지 않습니다/);
assert.strictEqual(fs.readFileSync(path.join(other, 'docs-site', 'index.html'), 'utf8'), 'hand made');

fs.rmSync(dir, { recursive: true, force: true });
fs.rmSync(other, { recursive: true, force: true });
console.log('check-screens.test.js ✔');
