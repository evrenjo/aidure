#!/usr/bin/env node
/**
 * query-predicates.test.js — query-predicates.js 회귀 테스트 (fixtures/sample-app 만 쓴다, 실 프로젝트 불필요).
 *   node packs/stack-spring/bin/query-predicates.test.js
 */
'use strict';
const path = require('path');
const cp = require('child_process');

const TOOL = path.join(__dirname, 'query-predicates.js');
const APP = path.join(__dirname, 'fixtures', 'sample-app');
const J = path.join(APP, 'src', 'main', 'java', 'com', 'example', 'app');

let fail = 0;
const check = (n, ok, d) => {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${n}${ok || !d ? '' : '\n       ' + d}`);
  if (!ok) fail++;
};
const run = (f) => JSON.parse(cp.execFileSync('node', [TOOL, f, '--json', '--root', APP], { encoding: 'utf8', maxBuffer: 1e8 }));

// ① 헬퍼 폐쇄 + static 별칭 + @Column 이름 + 기본 명명
{
  const j = run(path.join(J, 'query', 'order', 'OrderQuery.java'));
  const r = j.results.find((x) => x.method === 'findOpenOrders');
  check('기준표 = purchase_order', r && r.from.includes('purchase_order'), r && r.from.join(','));
  check('헬퍼(buildWhere) 폐쇄를 따라가 술어를 모은다', r && r.helpers.includes('buildWhere'), r && r.helpers.join(','));
  check('@Column(name) 여러 줄 애너테이션', r && r.columns.includes('purchase_order.order_status_code'), r && r.columns.join(','));
  check('@Column 없는 필드는 snake_case', r && r.columns.includes('purchase_order.is_deleted'), r && r.columns.join(','));
}

// ② 별칭 스코프 — 같은 이름 o 가 메서드마다 다른 Q타입
{
  const j = run(path.join(J, 'query', 'order', 'OrderQuery.java'));
  const a = j.results.find((x) => x.method === 'findLinesByItem');
  const b = j.results.find((x) => x.method === 'findOrdersWithAlias');
  check('o = QOrderLine 으로 해석 (@Table 없음 → order_line)', a && a.columns.includes('order_line.item_code'), a && a.columns.join(','));
  check('o = QPurchaseOrder 로 해석 (파일 단위였으면 틀린다)', b && b.columns.includes('purchase_order.owner_code'), b && b.columns.join(','));
  check('조인 테이블', b && b.joins.includes('order_line'), b && b.joins.join(','));
  check('상속 컬럼 (@MappedSuperclass)', b && b.columns.includes('purchase_order.created_at'), b && b.columns.join(','));
}

// ③ 파생 리포지토리
{
  const j = run(path.join(J, 'repository', 'order', 'PurchaseOrderRepository.java'));
  check('엔티티 → 테이블', j.table === 'purchase_order', j.table);
  const m = j.results.find((r) => r.method.startsWith('findAllByOwnerCode'));
  check('연산자(In)·OrderBy 를 넘기고 컬럼을 푼다', m && ['owner_code', 'order_status_code'].every((c) => m.columns.includes('purchase_order.' + c)) && m.order === 'CreatedAtDesc', m && m.columns.join(',') + ' / ' + m.order);
  const u = j.results.find((r) => r.method.startsWith('countBy'));
  check('없는 필드는 못 푼 조각으로 신고', u && u.unknown.includes('UnknownThing'), u && JSON.stringify(u.unknown));
}

// ④ 네이티브 SQL — 연결 문자열 + 텍스트블록
{
  const j = run(path.join(J, 'service', 'order', 'OrderSequenceService.java'));
  const n = j.results.find((r) => r.method === 'nextNumber');
  check('따옴표 식별자 + 연결 SQL 에서 표·WHERE', n && n.raw.tables.includes('order_line') && n.raw.cols.includes('purchase_order_id'), n && JSON.stringify(n.raw));
  const c = j.results.find((r) => r.method === 'copyLines');
  check('INSERT … SELECT 텍스트블록', c && c.raw.tables.includes('order_line'), c && JSON.stringify(c.raw));
}

// ⑤ --find
{
  const out = cp.execFileSync('node', [TOOL, '--find', 'order', '--root', APP], { encoding: 'utf8' });
  check('--find 로 Query·Repository 를 찾는다', /OrderQuery\.java/.test(out) && /PurchaseOrderRepository\.java/.test(out), out);
}

console.log(fail ? `\n■ 실패 ${fail}건\n` : '\n■ 전부 통과\n');
process.exitCode = fail ? 1 : 0;
