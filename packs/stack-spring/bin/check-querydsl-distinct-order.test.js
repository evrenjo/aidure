#!/usr/bin/env node
/**
 * check-querydsl-distinct-order.js 회귀 테스트 — 임시 픽스처로 탐지·무시를 함께 확인한다.
 *   node packs/stack-spring/bin/check-querydsl-distinct-order.test.js
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const CHECKER = path.join(__dirname, 'check-querydsl-distinct-order.js');
const SRC = `package fixture;
public class SampleQuery {
  void badTemplate() {
    queryFactory.select(o.code).distinct().from(o)
        .orderBy(Expressions.stringTemplate("lower({0})", o.code).asc()).fetch();
  }
  void badHelper() {
    queryFactory.select(o.code).distinct().from(o).orderBy(SortKeys.asc(o.code), o.id.desc()).fetch();
  }
  void badCoalesce() {
    jpaQueryFactory.select(o.code).from(o).distinct().orderBy(o.name.coalesce("").asc()).fetch();
  }
  void okSimple() {
    queryFactory.select(o.code).distinct().from(o).orderBy(o.code.asc(), o.name.desc().nullsLast()).fetch();
  }
  void okNoDistinct() {
    queryFactory.select(o.code).from(o).orderBy(SortKeys.asc(o.code)).fetch();
  }
  void okSameExprSelected() {
    queryFactory.select(o.code.trim()).distinct().from(o).orderBy(o.code.trim().asc()).fetch();
  }
  void badSelectDistinct() {
    queryFactory.selectDistinct(o.code).from(o).orderBy(o.code.trim().asc()).fetch();
  }
  void unknownVar() {
    queryFactory.select(o.code).distinct().from(o).orderBy(orders).fetch();
  }
  void custom() {
    queryFactory.select(o.code).distinct().from(o).orderBy(MY_ORDER).fetch();
  }
}
`;

function run(args) {
  try {
    return { code: 0, out: execFileSync('node', [CHECKER, ...args], { encoding: 'utf8' }) };
  } catch (e) {
    return { code: e.status, out: e.stdout || '' };
  }
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'distinct-'));
fs.writeFileSync(path.join(root, 'SampleQuery.java'), SRC);
const r = run(['--root', root, '--list']);
const rc = run(['--root', root, '--pattern', '^MY_ORDER$']);
fs.rmSync(root, { recursive: true, force: true });

const fail = [];
if (r.code !== 1) fail.push(`위반 픽스처인데 exit ${r.code}`);
if (!/같은 체인에 쓴 곳 4건/.test(r.out)) fail.push('탐지 건수가 4건이 아니다 (template·helper·coalesce·selectDistinct)');
if (/o\.id\.desc|o\.name\.desc/.test(r.out.split('✗')[1] || '')) fail.push('단순 경로 정렬을 위반으로 잡았다');
if ((r.out.match(/o\.code\.trim\(\)\.asc/g) || []).length !== 1) fail.push('select 에 같은 식이 있는 정렬을 위반으로 잡았거나 selectDistinct 를 놓쳤다');
if (!/판단 불가\(정렬이 변수\) 2곳/.test(r.out)) fail.push('변수 정렬 2곳을 판단 불가로 세지 않았다');
if (!/같은 체인에 쓴 곳 5건/.test(rc.out)) fail.push('--pattern 사용자 정렬을 잡지 못했다');

if (fail.length) {
  console.log('✗ 실패 ' + fail.length + '건');
  for (const f of fail) console.log('  - ' + f);
  console.log(r.out);
  process.exit(1);
}
console.log('✓ distinct-order 회귀 테스트 통과 (식 정렬 탐지 4 · select 에 같은 식이면 통과 · 단순 정렬 무시 · 변수 정렬 판단 불가 · --pattern)');
