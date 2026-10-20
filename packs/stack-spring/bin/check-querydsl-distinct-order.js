#!/usr/bin/env node
/**
 * QueryDSL 체인에서 `.distinct()` 와 **식(expression) 정렬**을 함께 쓴 곳을 찾는다. 위반 있으면 exit 1.
 *
 *   node packs/stack-spring/bin/check-querydsl-distinct-order.js [--list] [--root <Java 소스>] [--pattern <정규식>]
 *
 * 왜: PostgreSQL 은 SELECT DISTINCT 에서 ORDER BY 식이 select list 에 **같은 식으로** 있기를 요구한다.
 * `Expressions.*Template(…)`·함수 호출·정렬 헬퍼(`SortKeys.asc(col)` 처럼 SQL 식을 만드는 static 메서드)는
 * 컬럼이 select list 에 있어도 별개 식이라 거부된다 — 컴파일·기동에선 안 보이고 그 쿼리가 도는 순간 터진다.
 *
 *   ERROR: for SELECT DISTINCT, ORDER BY expressions must appear in select list
 *
 * 판정: orderBy 인자 중 `alias.field.asc()`·`.desc()`(+ nullsFirst/Last) 같은 **단순 경로 정렬이 아닌 것**으로,
 *   ① Expressions. / Template( 가 들어 있거나 ② 대문자로 시작하는 static 헬퍼 호출(`X.asc(`/`X.desc(`)이거나
 *   ③ --pattern 정규식에 맞는 것. 변수 하나(`.orderBy(orders)`)는 판단 불가로 세기만 한다.
 * 고치는 법: 그 정렬을 빼고 fetch() 뒤 Java 에서 정렬하거나, 같은 식을 select 에 넣고 DISTINCT 대신 GROUP BY 를 검토한다.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { resolve, javaFiles } = require('./lib/spring-src');

const CHAIN = /\b\w*[qQ]ueryFactory\s*\.\s*(?:select|selectDistinct|selectFrom|from)\b[\s\S]*?\.fetch(?:One|First|Count|Results)?\s*\(\s*\)/g;
const SIMPLE = /^[\w$.]+\.(?:asc|desc)\s*\(\s*\)(?:\s*\.\s*nulls(?:First|Last)\s*\(\s*\))*$/;

function matchParen(s, open) {
  let d = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === '(') d++;
    else if (s[i] === ')' && --d === 0) return i;
  }
  return -1;
}

function splitArgs(inner) {
  const out = [];
  let d = 0;
  let cur = '';
  for (const ch of inner) {
    if ('([{'.includes(ch)) d++;
    else if (')]}'.includes(ch)) d--;
    if (ch === ',' && d === 0) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** 체인 안 method(...) 인자들 */
function callArgs(chain, method) {
  const args = [];
  for (const m of chain.matchAll(new RegExp('\\.' + method + '\\s*\\(', 'g'))) {
    const open = m.index + m[0].length - 1;
    const close = matchParen(chain, open);
    if (close !== -1) args.push(...splitArgs(chain.slice(open + 1, close)));
  }
  return args;
}

const norm = (s) => s.replace(/\s+/g, '');

function classify(arg, custom) {
  const a = arg.replace(/\s+/g, ' ').trim();
  if (SIMPLE.test(a.replace(/\s/g, ''))) return 'simple';
  if (custom && custom.test(a)) return 'expr';
  if (/Expressions\.|Template\s*\(/.test(a)) return 'expr';
  if (/\b[A-Z][\w$]*\.(?:asc|desc)\s*\(/.test(a)) return 'expr';
  if (/^new\s+OrderSpecifier\s*\(/.test(a)) {
    const inner = a.slice(a.indexOf('(') + 1, -1);
    const target = splitArgs(inner)[1] || '';
    return /\(/.test(target) ? 'expr' : 'simple';
  }
  if (/^[\w$]+$/.test(a)) return 'unknown';
  return /\(/.test(a.replace(/\.(?:asc|desc|nullsFirst|nullsLast)\s*\(\s*\)/g, '')) ? 'expr' : 'simple';
}

function scan(root, custom) {
  const hits = [];
  const unknown = [];
  let chains = 0;
  for (const file of javaFiles(root)) {
    const src = fs.readFileSync(file, 'utf8');
    if (!/\.distinct\(\)|\.selectDistinct\(/.test(src)) continue;
    for (const m of src.matchAll(CHAIN)) {
      const chain = m[0];
      if (!/\.distinct\(\)|\.selectDistinct\(/.test(chain)) continue;
      chains++;
      const line = src.slice(0, m.index).split('\n').length;
      const selected = new Set(['select', 'selectDistinct'].flatMap((mth) => callArgs(chain, mth)).map(norm));
      for (const arg of callArgs(chain, 'orderBy')) {
        // select 에 같은 식이 있으면 PostgreSQL 이 받아준다
        if (selected.has(norm(arg).replace(/\.(?:asc|desc)\(\)(?:\.nulls(?:First|Last)\(\))*$/, ''))) continue;
        const k = classify(arg, custom);
        if (k === 'expr') hits.push({ file, line, arg: arg.replace(/\s+/g, ' ') });
        else if (k === 'unknown') unknown.push({ file, line, arg });
      }
    }
  }
  return { hits, unknown, chains };
}

function main() {
  const argv = process.argv;
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log('사용법: node packs/stack-spring/bin/check-querydsl-distinct-order.js [--list] [--root <Java 소스>] [--pattern <정규식>]');
    return 0;
  }
  const src = resolve(argv);
  if (src.error) {
    console.log(`건너뜀: ${src.error}`);
    return 0;
  }
  const pi = argv.indexOf('--pattern');
  const custom = pi !== -1 && argv[pi + 1] ? new RegExp(argv[pi + 1]) : null;
  const { hits, unknown, chains } = scan(src.base, custom);
  const rel = (f) => path.relative(process.cwd(), f);

  if (argv.includes('--list')) console.log(`DISTINCT 가 든 QueryDSL 체인 ${chains}개 검사 (${rel(src.base) || '.'})`);
  if (unknown.length && argv.includes('--list')) {
    console.log(`판단 불가(정렬이 변수) ${unknown.length}곳. 직접 확인`);
    for (const u of unknown) console.log(`  ${rel(u.file)}:${u.line}  orderBy(${u.arg})`);
  }
  if (!hits.length) {
    console.log('✓ DISTINCT + 식 정렬 동시 사용 없음');
    return 0;
  }
  console.log(`✗ DISTINCT 와 식 정렬을 같은 체인에 쓴 곳 ${hits.length}건. PostgreSQL 에서 실행 시 실패한다\n`);
  for (const h of hits) console.log(`  ${rel(h.file)}:${h.line}\n    orderBy = ${h.arg}`);
  console.log('\n  고치는 법: 그 정렬을 빼고 fetch() 뒤 Java 에서 정렬 (또는 같은 식을 select 에 넣고 GROUP BY 검토)');
  return 1;
}

module.exports = { classify, scan };
if (require.main === module) process.exitCode = main();
