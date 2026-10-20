#!/usr/bin/env node
/**
 * asis-field-writes.js — 레거시 폐쇄 안에서 한 필드의 쓰기 지점을 전수로, 호출 경로 순으로 뽑는다.
 * "첫 대입을 보고 결론내는" 오독을 막는 것이 목적이다 — 경로 끝의 쓰기가 최종값 후보다.
 *
 *   node packs/modernization/bin/asis-field-writes.js <파일> --entry <이름|라인>[,...] --field <FIELD> [옵션]
 *     --record R    특정 레코드로 한정
 *     --table T     그 테이블에 매핑된 레코드 전부로 한정 — 권장 단위 (레코드→테이블 매핑이 있는 방언만, 예: EGL)
 *     --json        기계 판독용
 *
 * 순서는 호출 경로 DFS 기준 **근사**다 — 분기가 있으면 전부 실행되지는 않으므로 조건을 함께 봐야 한다.
 */
'use strict'
const path = require('path')
const pick = require(path.join(__dirname, 'asis-dialect.js'))
const { arg, resolveSource } = require(path.join(__dirname, 'asis-config.js'))

const given = process.argv[2]
const entry = arg('entry')
const field = arg('field')
if (!given || given.startsWith('--') || !entry || entry === true || !field || field === true) {
  console.error('사용법: node packs/modernization/bin/asis-field-writes.js <파일> --entry <이름|라인>[,...] --field <FIELD> [--record R] [--table T] [--json]')
  process.exit(2)
}
let file
try {
  file = resolveSource(given)
} catch (e) {
  console.error(e.message)
  process.exit(2)
}
const onlyRec = arg('record', null)
const onlyTable = arg('table', null)

const dialect = pick(file)
const ast = dialect.parse(file)
const clo = dialect.closure(ast, String(entry).split(',').map((s) => s.trim()).filter(Boolean))

const FLD = field.toUpperCase()
let tableRecs = null
if (onlyTable) {
  tableRecs = new Set()
  for (const r of ast.records.values()) {
    if (r.tables.some((t) => t.toUpperCase() === String(onlyTable).toUpperCase()) && r.columns.has(FLD)) tableRecs.add(r.name)
  }
  if (!tableRecs.size) {
    console.error(`테이블 ${onlyTable} 에 매핑되면서 필드 ${FLD} 를 가진 레코드가 없습니다`)
    process.exit(1)
  }
}
const keep = (rec) => (onlyRec ? rec === onlyRec : tableRecs ? tableRecs.has(rec) : true)
const sites = dialect.fieldWrites(ast, clo, FLD, { keep })

if (arg('json')) {
  console.log(JSON.stringify({ entry: clo.entry, field: FLD, sites }, null, 2))
  return // process.exit 은 파이프로 나가는 긴 출력을 자른다
}

const pad = (s, n) => String(s).padEnd(n)
console.log(`\n■ 진입점: ${clo.entry}   필드: ${FLD}${onlyRec ? `   레코드: ${onlyRec}` : ''}${onlyTable ? `   테이블: ${onlyTable} (레코드 ${[...tableRecs].join(',')})` : ''}`)
const cols = new Set()
for (const s of sites) {
  const r = ast.records.get(s.rec)
  if (r && r.columns.has(FLD)) cols.add(`${s.rec}.${FLD} → ${r.columns.get(FLD)}`)
}
if (cols.size) console.log('■ 컬럼 매핑: ' + [...cols].join(' / '))
console.log(`■ 쓰기 지점 ${sites.length}개 (호출 경로 순. 분기가 있으므로 전부 실행되지는 않는다)\n`)

console.log(`  ${pad('#', 4)}${pad(dialect.unit + ':라인', 20)}${pad('레코드', 12)}${pad('종류', 10)}값`)
console.log('  ' + '─'.repeat(88))
sites.forEach((s, i) => {
  console.log(`  ${pad(i + 1, 4)}${pad(s.fn + ':' + s.line, 20)}${pad(s.rec, 12)}${pad(s.how, 10)}${s.expr}`)
})
if (sites.length) {
  const last = sites[sites.length - 1]
  console.log(`\n  ▶ 경로 끝의 쓰기: ${last.fn}:${last.line}  ${last.rec}.${FLD} = ${last.expr}`)
  console.log('    첫 대입만 보고 결론내지 말 것. 위 목록의 조건 분기를 함께 확인한다.')
}
console.log()
