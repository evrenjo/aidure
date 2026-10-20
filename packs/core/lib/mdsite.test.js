// mdsite.js 점검: 경로 미러 · 정의 앵커 · 대조 절 · 다른 문서 ID · 줄여 쓴 번호 · 색인 · 장 HTML · 링크 안전. 실행: node mdsite.test.js
'use strict';
const assert = require('assert');
const M = require('./mdsite');

const files = {
  'README.md': '# 기획 문서\n\n안내. [요구사항](01-requirements/) · [없는 폴더](99-none/)\n',
  'AGENTS.md': '# 지침\n',
  '01-requirements/_template.md': '# REQ-000 견본\n',
  '01-requirements/REQ-001.md': '# REQ-001 로그인\n\n> 상태: 확정\n\n본문. 관련 [정책](../03-policies/POL-001.md#규칙) · 원본 [파일](../originals/a.docx) · [x](javascript:alert(1))\n',
  '30-design-a.md': [
    '# 상세 설계 — 주문', '', '| 항목 | 내용 |', '|---|---|', '| 상태 | **초안 — 리뷰 전** |', '| 선행 문서 | [아키텍처](10-arch.md) (A-1 · A-2) |', '',
    '## 1. 결정', '', '**D1-1**: 주문은 한 번만 보낸다(A-1).', '', '### 1.2 재시도 (D1-2)', '', '재시도 규칙. 같은 문서 D1-1 을 따른다. 배송 설계 D1-1 과 다르다.', '',
    '## 2. 검증', '', '| ID | 내용 |', '|---|---|', '| VS-A-01 | 중복 없음 |', '| VS-A-02 | 한도 |', '', '근거: VS-A-01 · 02, REQ-001, REQ-009',
    '', '## 3. 요구사항 대조', '', '| 요구 | 반영 |', '|---|---|', '| REQ-001 | §1 |', '| D1-1 | §1 |', ''].join('\n'),
  '30-design-b.md': '# 상세 설계 — 배송\n\n**D1-1**: 배송은 하루 한 번.\n\n- [ ] 남은 일\n  - [x] 끝난 일\n',
  '10-arch.md': '# 아키텍처\n\n| # | 결정 |\n|---|---|\n| A-1 | 단일 접점 |\n| A-2 | 큐 |\n\n상세는 30-design-a.md D1-2 를 본다.\n',
  '03-policies/POL-001.md': '# POL-001 비밀번호\n\n## 규칙\n\n1. 8자 이상\n',
  '02-screens/web.html': '<!doctype html><html><head><title>화면</title><link rel="stylesheet" href="storyboard.css"></head><body data-doc="웹 화면설계서">'
    + '<section class="sheet" id="SCR-001" data-group="공통"><table class="meta screen-meta"><tr><th>Related ID</th><td>REQ-001</td></tr></table></section>'
    + '<script src="storyboard.js"></script></body></html>',
  '02-screens/_template.html': '<section class="sheet" id="SCR-000"></section>',
  'html/old.html': 'x',
  'originals/a.docx': 'x',
};
const res = M.build(files, { title: '테스트', prefixes: ['REQ'], assets: { 'assets/site.css': 'css' } });
const P = res.pages;

// 경로: md 는 같은 경로의 .html, README 는 폴더 index, 견본 · 지침 · html/ · originals/ 는 뺀다
assert.ok(P['index.html'] && P['01-requirements/REQ-001.html'] && P['30-design-a.html'] && P['02-screens/web.html']);
assert.ok(P['01-requirements/index.html'], '폴더 목록 페이지');
for (const k of Object.keys(P)) assert.ok(!/_template|AGENTS|^html\/|originals/.test(k), `뺄 파일 ${k}`);
assert.ok(P['assets/site.css']);

// 정의 앵커: 제목 · 굵은 머리말 · 표 행(tr id) · 괄호 제목
assert.match(P['01-requirements/REQ-001.html'], /<h1><span id="REQ-001">REQ-001<\/span> 로그인<\/h1>/);
const a = P['30-design-a.html'];
assert.match(a, /<span id="D1-1">D1-1<\/span>/);
assert.match(a, /<tr id="VS-A-01">/);
assert.match(a, /<span id="D1-2">D1-2<\/span>/);
assert.ok(!/<tr id="REQ-001">/.test(a), '대조 절의 남의 ID 는 정의가 아니다');
assert.ok(!/<tr id="D1-1">/.test(a), '대조 절 행은 이 문서의 강한 정의가 있으면 앵커를 달지 않는다');

// 링크: 같은 페이지 · 다른 페이지 · 「배송 설계 D1-1」 은 배송 문서로 · 선행 문서 목록의 A-1 은 아키텍처로 · 줄여 쓴 번호
assert.match(a, /같은 문서 <a class="ds-id" href="#D1-1">D1-1<\/a>/);
assert.match(a, /배송 설계 <a class="ds-id" href="30-design-b.html#D1-1">D1-1<\/a>/);
assert.match(a, /\(<a class="ds-id" href="10-arch.html#A-1">A-1<\/a>\)/);
assert.match(a, /VS-A-01<\/a> · <a class="ds-id" href="#VS-A-02">02<\/a>/);
assert.match(a, /<a class="ds-id" href="01-requirements\/REQ-001.html#REQ-001">REQ-001<\/a>/);
assert.match(a, /<span class="ds-broken"[^>]*>REQ-009<\/span>/, '머리말이 있는데 정의가 없으면 표시');
assert.ok(res.warnings.some((w) => /REQ-009/.test(w)));
assert.match(P['10-arch.html'], /30-design-a.md <a class="ds-id" href="30-design-a.html#D1-2">D1-2<\/a>/, '「파일.md ID」 는 그 문서로');

// md 링크 → 페이지, 원본 · javascript: 는 글자만
const r = P['01-requirements/REQ-001.html'];
assert.match(r, /href="..\/03-policies\/POL-001.html#규칙"/);
assert.ok(!/href="javascript:/.test(r) && !/href="[^"]*a\.docx"/.test(r), '원본 파일 · javascript: 는 링크로 만들지 않는다');
assert.match(r, /<span class="ds-nolink" title="..\/originals\/a.docx">파일<\/span>/);
assert.match(r, /ds-badge" data-status="확정"/);
assert.match(P['30-design-a.html'], /data-status="초안"/);

assert.match(P['index.html'], /<a href="01-requirements\/index.html">요구사항<\/a>/, '폴더 링크 → 폴더 목록 페이지');
assert.match(P['index.html'], /<span class="ds-nolink" title="99-none\/">/);

// 할 일 목록 중첩
assert.match(P['30-design-b.html'], /<li class="ds-task"><input type="checkbox" disabled> 남은 일<ul><li class="ds-task"><input type="checkbox" disabled checked> 끝난 일<\/li><\/ul><\/li>/);

// 장 HTML: 뷰어 경로 · data-root 를 사이트 위치로
const w = P['02-screens/web.html'];
assert.match(w, /href="..\/assets\/storyboard\/storyboard.css"/);
assert.match(w, /src="..\/assets\/storyboard\/storyboard.js"/);
assert.match(w, /<body data-back="index.html#sheet-docs" data-root="..\/" data-doc/, '뷰어 「← 문서」 = 화면설계 개요(폴더 쪽)');

// 색인: 실제 id 만, 키 정렬, D1-1 은 두 문서, 장 id 포함, 문서 이름
const ix = JSON.parse(P['assets/ids.json']);
assert.deepStrictEqual(Object.keys(ix.ids), Object.keys(ix.ids).slice().sort());
assert.deepStrictEqual(ix.ids['D1-1'], ['30-design-a.html#D1-1', '30-design-b.html#D1-1']);
assert.deepStrictEqual(ix.ids['SCR-001'], ['02-screens/web.html#SCR-001']);
assert.deepStrictEqual(ix.ids['A-1'], ['10-arch.html#A-1']);
assert.strictEqual(ix.docs['30-design-a.md'], '30-design-a.html');
assert.deepStrictEqual(ix.prefixes, ['REQ']);

// 같은 입력이면 같은 출력
const again = M.build(files, { title: '테스트', prefixes: ['REQ'], assets: { 'assets/site.css': 'css' } });
assert.deepStrictEqual(Object.keys(again.pages), Object.keys(P));
for (const k of Object.keys(P)) assert.strictEqual(String(again.pages[k]), String(P[k]), k);

// 화면 틀: 상단 바 · 구분 메뉴 · 본문 머리 · 오른쪽 목차 · 이전/다음 · 검색 색인
const nav = (h) => [...h.matchAll(/<summary class="nav-title"><span class="ico">[^<]*<\/span>([^<]*)(?:<a class="nav-act"[^>]*>[^<]*<\/a>)?<\/summary>((?:<a [^>]*>[^<]*<\/a>)*)/g)].map((m) => [m[1], [...m[2].matchAll(/>([^<]*)<\/a>/g)].map((x) => x[1])]);
const navOf = (pages) => JSON.parse(String(pages['assets/nav.js']).replace(/^window\.DS_NAV = /, '').replace(/;\n$/, '')).html;
const NAV = navOf(P);
const g0 = nav(NAV);
// 메뉴는 쪽마다 넣지 않고 assets/nav.js 하나 (쪽에는 빈 nav + 지금 쪽)
assert.match(P['30-design-a.html'], /<nav class="side" id="side-nav" data-page="30-design-a.html"><noscript>/);
assert.ok(!/nav-link" href="(?!\.)/.test(P['30-design-a.html'].replace(/<noscript>.*?<\/noscript>/s, '')), '쪽에 메뉴 링크가 없다');
assert.match(P['30-design-a.html'], /<script src="assets\/nav.js"><\/script>\n<script src="assets\/site.js">/);
// 머리 줄: 펜 필기 · 인쇄(이 문서 · 전체) · 테마, 같은 선 아이콘(SVG). 전체 인쇄 쪽은 하나 (site.js 가 문서를 불러와 잇는다)
assert.match(P['30-design-a.html'], /<button id="ink" type="button"[^>]*><svg [^>]*width="18"[^>]*>.*?<\/svg><\/button><button id="print" type="button"[^>]*><svg .*?<\/svg><\/button><button id="theme" type="button"[^>]*><svg /);
assert.match(P['print-all.html'], /<div id="print-all"><p class="print-status">/);
{
  const off = M.build({ 'README.md': '# 첫\n' }, { title: 't', config: { ink: false, printAll: { autoPrint: false } } }).pages;
  assert.ok(!/id="ink"/.test(off['index.html']), 'ink: false = 펜 단추 없음');
  assert.match(off['print-all.html'], /<div id="print-all" data-auto="0">/, 'printAll.autoPrint: false');
  const logo = (title, cfg) => M.build({ 'README.md': '# 첫\n' }, { title, config: cfg }).pages['index.html'].match(/<span class="logo">([^<]*)</)[1];
  assert.strictEqual(logo('XD 분석'), 'XD', '첫 낱말이 2~3자 영문 약어면 대문자 그대로');
  assert.strictEqual(logo('erp 기획 문서'), 'ERP');
  assert.strictEqual(logo('Trader Jo'), 'tj', '아니면 앞 두 낱말 첫 글자');
  assert.strictEqual(logo('XD 분석', { logo: 'Q' }), 'Q', '설정 logo 가 먼저');
}
// 화면설계서 장 파일은 메뉴에 없고, 묶음 첫 항목은 개요(폴더 쪽: 장 수 · 묶음별 화면 · 설계서 보기), 묶음 제목 옆 ▶ 버튼
assert.deepStrictEqual(g0.find((x) => x[0] === 'screens')[1], ['화면설계서 개요']);
assert.match(NAV, /screens<a class="nav-act" href="02-screens\/web.html" data-p="02-screens\/web.html" data-h="" title="설계서 보기"/);
assert.match(P['02-screens/index.html'], /<h2 id="sheet-docs">화면설계서<\/h2>.*장 1 · 02-screens\/web.html.*<a class="ds-btn" href="web.html">▶ 설계서 보기<\/a>.*<td>공통<\/td><td><a href="web.html#SCR-001">SCR-001<\/a><\/td>/s);
// README 가 있는 화면 폴더: README 쪽 맨 위(본문 앞)에 설계서 블록 · 목차 첫 줄
const withReadme = M.build({ ...files, '02-screens/README.md': '# 화면 목록\n\n## 규칙\n\n긴 본문\n' }, {}).pages['02-screens/index.html'];
assert.ok(withReadme.indexOf('id="sheet-docs"') < withReadme.indexOf('id="규칙"'), '설계서 블록이 본문보다 먼저');
assert.match(withReadme, /<div id="toc"><a class="l2" href="#sheet-docs"/);
// 문서 목록 쪽은 메뉴 묶음별 제목 + 표
assert.match(P['index.html'], /<h2 id="docs-list">문서<\/h2>\n<h3 id="docs-아키텍처">.*<h3 id="docs-screens">.*화면설계서 · 장 1/s);
assert.deepStrictEqual(g0.map((x) => x[0]), ['시작', '아키텍처', '상세 설계', 'requirements', 'screens', 'policies'], '폴더 · 번호 띠 · 공통 낱말 · 폴더 이름(번호 뺌)');
assert.deepStrictEqual(g0[2][1], ['상세 설계 — 주문', '상세 설계 — 배송']);
assert.match(NAV, /<a class="nav-link" href="30-design-a.html" data-p="30-design-a.html">/);
assert.match(P['30-design-a.html'], /<div class="crumb">상세 설계 <span class="ds-badge" data-status="초안">/);
assert.match(P['30-design-a.html'], /<aside class="toc">.*<a class="l2" href="#1-결정" data-id="1-결정">1. 결정<\/a>/s);
assert.match(P['30-design-a.html'], /<div class="pager"><a class="prev"/);
assert.ok(!/class="src"/.test(P['30-design-a.html']), 'source 가 없으면 원본 버튼 없음');
const S = JSON.parse(P['assets/search.js'].replace(/^[\s\S]*?window.DS_SEARCH = /, '').replace(/;\s*$/, ''));
assert.ok(S.pages.some((x) => x.u === '30-design-a.html' && x.h.some((h) => h[1] === '1. 결정')));
assert.ok(S.ids.some((x) => x[0] === 'REQ-001' && x[1] === '01-requirements/REQ-001.html#REQ-001'));

// docs-site.json: 묶음 · 원본 · 버전 · README 를 ## 마다 쪽으로
const withCfg = M.build({ ...files, 'README.md': '# 기획\n\n안내\n\n## 보는 법\n\n[요구](01-requirements/REQ-001.md)\n\n## 고치는 법\n\n본문\n' }, {
  config: { title: '우리 기획', version: 'v0.3', source: 'https://git.example.com/g/plans/-/blob/main',
    groups: [{ group: '시작', icon: '▶', files: ['README.md'], split: true }, { group: '설계', files: ['30-*.md', '10-*.md'] }] },
});
const C = withCfg.pages;
assert.ok(C['README--보는-법.html'] && C['README--고치는-법.html'] && C['index.html'], '## 마다 쪽');
assert.deepStrictEqual(nav(navOf(C)).map((x) => x[0]), ['시작', '설계', '기타']);
assert.deepStrictEqual(nav(navOf(C))[0][1], ['개요', '보는 법', '고치는 법']);
assert.ok(withCfg.unlisted.length > 0 && withCfg.unlisted.every((f) => !/^(README|30-|10-)/.test(f)), `묶음에 안 맞은 문서 = 「기타」: ${withCfg.unlisted}`);
assert.deepStrictEqual(nav(navOf(C))[1][1], ['상세 설계 — 주문', '상세 설계 — 배송', '아키텍처']);
assert.match(C['30-design-a.html'], /<a class="src" href="https:\/\/git.example.com\/g\/plans\/-\/blob\/main\/30-design-a.md"/);
assert.match(C['index.html'], /<span>v0.3<\/span>/);
assert.match(C['index.html'], /<span class="logo">우기<\/span>우리 기획/);
assert.strictEqual(JSON.parse(C['assets/ids.json']).docs['README.md'], 'index.html', '나눈 문서는 원본 이름 → 첫 쪽');
assert.match(C['README--보는-법.html'], /href="01-requirements\/REQ-001.html"/, '나눈 쪽의 상대 링크');

// mermaid: 코드 블록 → 그림 자리(확대 · 새 창 단추), mermaid 파일은 그림이 있는 사이트에만
const MM = { 'assets/mermaid/mermaid.min.js': 'js' };
const withMm = M.build({ 'README.md': '# 문서\n\n```mermaid\nflowchart LR\n  A[웹] --> B[(DB <스키마>)]\n```\n\n```js\nx\n```\n' }, { title: 't', mermaid: MM }).pages;
assert.match(withMm['index.html'], /<div class="diagram"><div class="diagram-tools">.*<pre class="mermaid">flowchart LR\n {2}A\[웹\] --&gt; B\[\(DB &lt;스키마&gt;\)\]<\/pre><\/div>/s, 'mermaid 블록은 원문을 이스케이프해 pre.mermaid 로');
assert.match(withMm['index.html'], /<pre><code class="lang-js">x<\/code><\/pre>/, '다른 코드 블록은 그대로');
assert.ok(withMm['assets/mermaid/mermaid.min.js'], '그림이 있으면 mermaid 파일을 넣는다');
assert.ok(!M.build({ 'README.md': '# 문서\n\n본문\n' }, { title: 't', mermaid: MM }).pages['assets/mermaid/mermaid.min.js'], '그림이 없으면 넣지 않는다');

// 날짜 항목이 쌓인 긴 칸: 첫 항목 + 나머지 접기. 짧거나 날짜 항목이 적으면 그대로
const long = ['2026-10-16: 알림 서비스 신설', '2026-10-08 계좌 분리 반영', '2026-10-03 신규 기능 추가'].map((x) => x + ' 설명'.repeat(40)).join('; ');
const folded = M.build({ 'README.md': `# 문서\n\n| 항목 | 내용 |\n|---|---|\n| 변경 | ${long} |\n| 짧음 | 2026-10-01 a; 2026-10-02 b; 2026-10-03 c |\n` }, { title: 't' }).pages['index.html'];
assert.match(folded, /<td><div class="ds-fold">2026-10-16: 알림 서비스 신설[^<]*<details><summary>나머지 2건 보기<\/summary><ul><li>2026-10-08 계좌/);
assert.match(folded, /<td>2026-10-01 a; 2026-10-02 b; 2026-10-03 c<\/td>/, '짧은 칸은 접지 않는다');

// 긴 칸: 첫 문장 + 더 보기 (cellFold 로 기준을 바꾼다). 링크 안은 끊지 않는다
const para = `첫 문장은 결론이다. ${'뒤 설명. '.repeat(60)}[링크. 안](a.md) 끝`;
const pf = M.build({ 'README.md': `# 문서\n\n| 항목 | 내용 |\n|---|---|\n| 긴 | ${para} |\n| 짧음 | 한 문장. 두 문장. |\n` }, { title: 't' }).pages['index.html'];
assert.match(pf, /<td><div class="ds-fold">첫 문장은 결론이다\.<details class="ds-more"><summary>더 보기<\/summary><div>뒤 설명\./);
assert.match(pf, /<td>한 문장\. 두 문장\.<\/td>/, '짧은 칸은 그대로');
assert.ok(!/ds-more/.test(M.build({ 'README.md': `# 문서\n\n| a | b |\n|---|---|\n| 긴 | ${para} |\n` }, { title: 't', cellFold: 5000 }).pages['index.html']), 'cellFold 를 올리면 접지 않는다');

// 결정 기록 표: 한 줄 목록 + 펼치면 카드, 행 ID 앵커는 카드에
const dt = M.build({ '50-decisions.md': '# 결정\n\n| ID | 결정 | 대안 | 이유 | 영향 | 상태 |\n|---|---|---|---|---|---|\n| D-1 | 커서 페이지 | 쪽 번호 | 대량 | 목록 API | 확정 |\n| D-2 | 알림은 텔레그램 |  |  |  | 초안 |\n' }, { title: 't' }).pages['50-decisions.html'];
assert.match(dt, /<div class="ds-decs"><details class="ds-dec" id="D-1"><summary><span class="ds-dec-id"><span id="D-1">D-1<\/span>|<div class="ds-decs"><details class="ds-dec" id="D-1"><summary><span class="ds-dec-id">D-1<\/span>/);
assert.match(dt, /<span class="ds-dec-t">커서 페이지<\/span> <span class="ds-badge" data-status="확정">확정<\/span><\/summary><dl><dt>대안<\/dt><dd>쪽 번호<\/dd><dt>이유<\/dt><dd>대량<\/dd><dt>영향<\/dt><dd>목록 API<\/dd><\/dl><\/details>/);
assert.match(dt, /<div class="ds-dec ds-dec-one" id="D-2">/, '펼칠 것이 없으면 한 줄만');
assert.ok(!/<table>/.test(dt.split('<article')[1]), '결정 표는 표로 그리지 않는다');

// 넓고 칸이 긴 표: 좁은 화면 카드용 표시 · 칸 이름
const wideRow = `| ${Array.from({ length: 4 }, () => '꽤 긴 설명이 들어간 칸 '.repeat(4)).join(' | ')} |`;
const wt = M.build({ 'README.md': `# 문서\n\n| 가 | 나 | 다 | 라 |\n|---|---|---|---|\n${wideRow}\n` }, { title: 't' }).pages['index.html'];
assert.match(wt, /<div class="table ds-cards"><table>.*<td data-label="가">/s);
assert.ok(!/ds-cards/.test(folded), '두 칸 표는 카드로 바꾸지 않는다');

// labels: 메뉴 이름만 바꾼다 (쪽 제목은 그대로)
const lbP = M.build({ 'README.md': '# 긴 제목의 기획 문서\n\n본문\n' }, { title: 't', config: { groups: [{ group: '시작', files: ['README.md'] }], labels: { 'README.md': '소개' } } }).pages;
const lb = lbP['index.html'];
assert.match(navOf(lbP), /<a class="nav-link" href="index.html" data-p="index.html">소개<\/a>/);
assert.match(lb, /<h1>긴 제목의 기획 문서<\/h1>/);

// 메뉴 접기 · 폴더 트리 (docs-site.json collapsed · tree): 모든 묶음은 접힌다, 옵션 없는 묶음은 처음엔 펼침
{
  const hist = { 'README.md': '# 첫\n', 'history/2024/01-a.md': '# 1월 기록\n', 'history/2024/02-b.md': '# 2월 기록\n', 'history/2025/01-c.md': '# 25년 1월\n', 'guide/a.md': '# 안내\n' };
  const cfg = { groups: [{ group: '시작', files: ['README.md'] }, { group: '안내', files: ['guide/**'], collapsed: true }, { group: '이력', files: ['history/**'], tree: true, collapsed: true }] };
  const hn = navOf(M.build(hist, { title: 't', config: cfg }).pages);
  assert.match(hn, /^<details class="nav-group" open data-k="시작"><summary class="nav-title"><span class="ico">[^<]*<\/span>시작<\/summary><a class="nav-link" href="index.html"/, '옵션 없는 묶음도 접히고 처음엔 펼침');
  assert.match(hn, /<details class="nav-group" data-k="안내"><summary class="nav-title"><span class="ico">[^<]*<\/span>안내<\/summary><a class="nav-link" href="guide\/a.html"/, 'collapsed = 접힌 묶음');
  assert.match(hn, /<details class="nav-group" data-k="이력"><summary class="nav-title">.*?<details class="nav-dir" data-k="이력\/2024"><summary>2024<\/summary><a class="nav-link" href="history\/2024\/01-a.html"[^>]*>1월 기록<\/a><a [^>]*>2월 기록<\/a><\/details><details class="nav-dir" data-k="이력\/2025"><summary>2025<\/summary>/s, 'tree = 폴더별로 접힘 (공통 폴더 history 는 뺀다)');
  const tOnly = navOf(M.build(hist, { title: 't', config: { groups: [{ group: '이력', files: ['history/**'], tree: true }] } }).pages);
  assert.match(tOnly, /<details class="nav-group" open data-k="이력">/, 'tree 만 주면 묶음은 펼친 채');
}
// 인용구: 「출처: · 근거: · 참고:」 줄은 작은 출처 줄(q-src)로 나눈다
{
  const q = M.build({ 'q.md': '# 인용\n\n> 결제는 하루 한 번 정산한다.\n> 출처: 정산 정책 회의 · 2026-10-01\n\n> 근거: OrderService.java:120\n' }, { title: 't' });
  const html = Object.entries(q.pages).find(([k]) => /q\.html$/.test(k))[1];
  assert.match(html, /<blockquote><p>결제는 하루 한 번 정산한다\.<\/p>\n?<p class="q-src">출처: 정산 정책 회의 · 2026-10-01<\/p><\/blockquote>/, html.slice(0, 0));
  assert.match(html, /<blockquote><p class="q-src">근거: OrderService\.java:120<\/p><\/blockquote>/);
}
console.log('mdsite.test.js ✔');
