#!/usr/bin/env node
/**
 * check-logging-convention.js 회귀 테스트 — 임시 픽스처로 위반 4종 탐지 + 정상 무시를 확인한다.
 *   node packs/stack-spring/bin/check-logging-convention.test.js
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const CHECKER = path.join(__dirname, 'check-logging-convention.js');
const FILES = {
  'service/OrderService.java': `package fixture.service;
@Service
public class OrderService {
  public void save(Form f) throws BindException {
    log.info("[ORDER] save: id={}", f.id());
    log.info(
        "[ORDER] save: id=" + f.id());
    try { x(); } catch (Exception e) { e.printStackTrace(); }
    System.out.println("debug");
    log.error("[ERR-500][ORDER] fail: {}", e.getMessage());
    log.error("[ORDER] fail", e);
    throw new BizException("ERR-409");
  }
}
`,
  'util/ErrorCode.java': `package fixture.util;
public enum ErrorCode { CONFLICT("ERR-409") }
`,
  'query/OrderQuery.java': `package fixture.query;
public class OrderQuery {
  // throw new BindException(x); comment only
  void ok() { log.debug("[ORDER] rows: n={}", n); }
}
`,
};

function run(args) {
  try {
    return { code: 0, out: execFileSync('node', [CHECKER, ...args], { encoding: 'utf8' }) };
  } catch (e) {
    return { code: e.status, out: e.stdout || '' };
  }
}
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'logconv-'));
for (const [rel, body] of Object.entries(FILES)) {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), body);
}
const r = run(['--root', root, '--code-literal', 'ERR-[0-9]+']);
const plain = run(['--root', root]);
fs.rmSync(root, { recursive: true, force: true });

const fail = [];
if (r.code !== 1) fail.push(`위반 픽스처인데 exit ${r.code}`);
if (!/BindException 을 던짐.*\(1\)/.test(r.out)) fail.push('서비스 BindException 1건 미탐지 (또는 주석을 셌다)');
if (!/System\.out·err.*\(2\)/.test(r.out)) fail.push('printStackTrace + System.out 2건 미탐지');
if (!/문자열 연결.*\(1\)/.test(r.out)) fail.push('여러 줄 호출의 문자열 연결 1건 미탐지');
if (!/문자열 리터럴.*\(1\)/.test(r.out)) fail.push('오류 코드 리터럴 1건 미탐지 (또는 enum 정의부를 셌다)');
if (!/확인 필요.*\(1\)/.test(r.out)) fail.push('getMessage() 만 넘긴 log.error 확인 필요 1건 미표시');
if (/문자열 리터럴/.test(plain.out)) fail.push('--code-literal 없이 코드 리터럴을 검사했다');

if (fail.length) {
  console.log('✗ 실패 ' + fail.length + '건');
  for (const f of fail) console.log('  - ' + f);
  console.log(r.out);
  process.exit(1);
}
console.log('✓ 로깅 컨벤션 검사기 회귀 테스트 통과 (위반 4종 · 확인 필요 1종 · 주석/enum 정의 무시)');
