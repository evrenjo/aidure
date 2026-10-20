#!/usr/bin/env node
/**
 * 로깅·예외 컨벤션 검사 (packs/stack-spring/rules/50-logging.md 의 "검사" 절). 위반 있으면 exit 1.
 *
 *   node packs/stack-spring/bin/check-logging-convention.js [--root <Java 소스>] [--code-literal <정규식>]
 *
 * 검사 (위반)
 *   ① 서비스가 checked BindException 을 던짐      — @Transactional 이 롤백하지 않는다 → 런타임 필드 검증 예외로
 *   ② printStackTrace() / System.out·err 출력      — 로그 수집기에 안 잡히고 레벨·추적 ID 가 없다
 *   ③ 로그 메시지 문자열 연결 ("..." + x)         — 레벨이 꺼져도 문자열을 만들고, 수집기 필드 추출이 깨진다 → {} placeholder
 *   ④ 오류 코드 문자열 리터럴 (--code-literal)    — 코드 enum 으로. 정의 파일(enum 선언부)은 제외
 * 확인 필요 (실패로 치지 않음)
 *   · log.error(…, e.getMessage()) 로 끝나고 예외 객체를 안 넘긴 줄 — 스택트레이스가 남지 않는다
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { resolve, javaFiles } = require('./lib/spring-src');

const LOG = 'log\\.(?:trace|debug|info|warn|error)';

function scan(root, codeLiteral) {
  const bad = { bind: [], stdout: [], concat: [], code: [] };
  const review = [];
  let files = 0;
  for (const file of javaFiles(root)) {
    files++;
    const src = fs.readFileSync(file, 'utf8');
    const lines = src.split('\n');
    const isService = /\/service\//.test(file.split(path.sep).join('/')) || /@Service\b/.test(src);
    const isCodeEnum = /\benum\s+\w*(?:Error)?Code\w*\b/.test(src);
    // 여러 줄 호출을 한 문장으로 모은다 (세미콜론까지)
    const stmts = [];
    for (const m of src.matchAll(new RegExp(`\\b${LOG}\\s*\\(`, 'g'))) {
      const end = src.indexOf(';', m.index);
      stmts.push({ text: src.slice(m.index, end === -1 ? undefined : end), line: src.slice(0, m.index).split('\n').length });
    }
    for (const s of stmts) {
      if (/"\s*\+\s*[\w(]|[\w)]\s*\+\s*"/.test(s.text)) bad.concat.push({ file, line: s.line, text: s.text.replace(/\s+/g, ' ').slice(0, 120) });
      if (/^log\.error/.test(s.text) && /\.getMessage\(\)\s*\)\s*$/.test(s.text)) review.push({ file, line: s.line, text: s.text.replace(/\s+/g, ' ').slice(0, 120) });
    }
    lines.forEach((l, i) => {
      const t = l.trim();
      if (t.startsWith('//') || t.startsWith('*')) return;
      if (isService && /throws\s+[\w, ]*\bBindException\b|throw\s+new\s+BindException\b|throw\s+(?:bind|bindException|bindingResult|errors)\s*;/.test(l)) bad.bind.push({ file, line: i + 1, text: t });
      if (/\.printStackTrace\s*\(\s*\)|System\.(?:out|err)\.print/.test(l)) bad.stdout.push({ file, line: i + 1, text: t });
      if (codeLiteral && !isCodeEnum && codeLiteral.test(l)) bad.code.push({ file, line: i + 1, text: t });
    });
  }
  return { bad, review, files };
}

function main() {
  const argv = process.argv;
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log('사용법: node packs/stack-spring/bin/check-logging-convention.js [--root <Java 소스>] [--code-literal <정규식, 예: "ERR-[0-9]+">]');
    return 0;
  }
  const src = resolve(argv);
  if (src.error) {
    console.log(`건너뜀: ${src.error}`);
    return 0;
  }
  const ci = argv.indexOf('--code-literal');
  const codeLiteral = ci !== -1 && argv[ci + 1] ? new RegExp(`"${argv[ci + 1]}"`) : null;
  const { bad, review, files } = scan(src.base, codeLiteral);
  const rel = (f) => path.relative(process.cwd(), f);
  const TITLES = {
    bind: '서비스가 BindException 을 던짐. 롤백 안 됨 (런타임 필드 검증 예외를 쓸 것)',
    stdout: 'printStackTrace / System.out·err. 로거를 쓸 것',
    concat: '로그 메시지 문자열 연결: {} placeholder 를 쓸 것',
    code: '오류 코드 문자열 리터럴: 코드 enum 을 쓸 것',
  };
  let n = 0;
  for (const [k, list] of Object.entries(bad)) {
    if (!list.length) continue;
    n += list.length;
    console.log(`\n  ✗ ${TITLES[k]} (${list.length})`);
    for (const h of list) console.log(`      ${rel(h.file)}:${h.line}  ${h.text}`);
  }
  if (review.length) {
    console.log(`\n  · 확인 필요. log.error 에 예외 객체 없이 getMessage() 만 (${review.length})`);
    for (const h of review) console.log(`      ${rel(h.file)}:${h.line}  ${h.text}`);
  }
  if (!n) {
    console.log(`✓ 로깅 컨벤션 위반 0건 (Java ${files}개)`);
    return 0;
  }
  console.log(`\n위반 ${n}건: 정본 packs/stack-spring/rules/50-logging.md`);
  return 1;
}

module.exports = { scan };
if (require.main === module) process.exitCode = main();
