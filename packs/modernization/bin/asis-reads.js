#!/usr/bin/env node
/**
 * asis-reads.js — 레거시(AS-IS) 폐쇄 안에서 "어느 표를 어떤 조건으로 읽는가" 를 뽑는다.
 * 조회 결함(기준 테이블·조인 키·WHERE 조건 불일치)은 쓰기 폐쇄로는 안 잡힌다.
 *
 *   node packs/modernization/bin/asis-reads.js <파일> --entry <이름|라인>[,...] [옵션]
 *     --table T     그 표를 읽는 지점만
 *     --sql         SQL 원문까지
 *     --cond        각 지점의 실행 조건 스택 (방언이 신뢰 불가로 판정하면 경고만)
 *     --json        기계 판독용
 *   --entry 없이 부르면 읽기를 전부 덮는 최소 진입점 조합을 추천한다.
 */
'use strict'
const path = require('path')
const pick = require(path.join(__dirname, 'asis-dialect.js'))
const C = require(path.join(__dirname, 'dialects', '_common.js'))
const { arg, resolveSource } = require(path.join(__dirname, 'asis-config.js'))

const given = process.argv[2]
if (!given || given.startsWith('--')) {
  console.error('사용법: node packs/modernization/bin/asis-reads.js <파일> --entry <이름|라인>[,...] [--table T] [--sql] [--cond] [--json]')
  process.exit(2)
}
let file
try {
  file = resolveSource(given)
} catch (e) {
  console.error(e.message)
  process.exit(2)
}
const dialect = pick(file)
const { parse, closure, reads, conditionsAt } = dialect
const ast = parse(file)
const UNIT = dialect.unit

/** 읽기를 전부 덮는 최소 진입점 조합을 그리디로 고른다 (후보가 수십 개면 사람이 못 고른다). */
function suggestEntries(a) {
  const target = new Set(reads(a, C.wholeFile(a)).map((r) => `${r.fn}:${r.line}`))
  if (!target.size) return { need: [], total: 0, covered: 0 }
  const cand = C.roots(a).map((r) => {
    const c = closure(a, [r])
    return { root: r, hits: new Set(reads(a, c).map((x) => `${x.fn}:${x.line}`)) }
  })
  const picked = []
  const got = new Set()
  while (got.size < target.size) {
    let best = null
    for (const c of cand) {
      if (picked.includes(c.root)) continue
      const gain = [...c.hits].filter((h) => !got.has(h)).length
      if (!best || gain > best.gain) best = { root: c.root, gain, hits: c.hits }
    }
    if (!best || best.gain === 0) break
    picked.push(best.root)
    for (const h of best.hits) got.add(h)
  }
  return { need: picked, total: target.size, covered: got.size }
}
const entry = arg('entry')
if (!entry || entry === true) {
  const r = C.roots(ast)
  console.error(`--entry 가 필요합니다. 진입점 후보 ${r.length}개: ${r.slice(0, 8).join(' ')}${r.length > 8 ? ' …' : ''}`)
  const sg = suggestEntries(ast)
  if (sg.need.length) {
    console.error(`\n  ▶ 읽기 ${sg.covered}/${sg.total} 를 덮는 최소 조합:  --entry ${sg.need.join(',')}`)
    if (sg.covered < sg.total) console.error(`     ⚠ ${sg.total - sg.covered}건은 어느 루트에서도 도달하지 않는다 (죽은 코드이거나 외부 진입)`)
  }
  process.exit(2)
}

const clo = closure(ast, String(entry).split(',').map((s) => s.trim()).filter(Boolean))
let rd = reads(ast, clo)

// 파일 전체 기준과 비교해 폐쇄 밖에 남은 읽기를 신고한다 — 진입점이 좁으면
// "그 표는 안 읽는다" 는 조용히 틀린 결론이 나온다
const allNames = [...ast.fns.keys()]
const inClo = new Set(rd.map((r) => `${r.fn}:${r.line}`))
const outside = reads(ast, C.wholeFile(ast)).filter((r) => !inClo.has(`${r.fn}:${r.line}`))
const onlyTable = arg('table', null)
if (onlyTable) rd = rd.filter((r) => r.tables.some((t) => t.toUpperCase().includes(String(onlyTable).toUpperCase())))

if (arg('json')) {
  console.log(JSON.stringify({ entry: clo.entry, reads: rd, unresolved: rd.unresolved || [], outsideClosure: outside.map((r) => ({ fn: r.fn, line: r.line, tables: r.tables })) }, null, 2))
  return // process.exit 은 파이프로 나가는 긴 출력을 자른다
}

const pad = (s, n) => String(s).padEnd(n)
console.log(`\n■ 진입점: ${clo.entry}  (${path.basename(file)}${dialect.label ? ', ' + dialect.label : ''})`)
console.log(`■ ${UNIT} 폐쇄 ${clo.internal.size}개 · 읽기 지점 ${rd.length}개${onlyTable ? ` (표 ${onlyTable} 한정)` : ''}\n`)

const byT = new Map()
for (const r of rd) for (const t of r.tables) {
  if (!byT.has(t)) byT.set(t, [])
  byT.get(t).push(r)
}
if (outside.length) {
  const t = [...new Set(outside.flatMap((r) => r.tables))]
  console.log(`  ⚠ 폐쇄 밖 읽기 ${outside.length}건: 진입점이 좁을 수 있습니다 (도달 ${clo.internal.size}/${allNames.length} ${UNIT})`)
  console.log(`    누락 후보 표: ${t.slice(0, 12).join(', ')}${t.length > 12 ? ' …' : ''}`)
  const sg = suggestEntries(ast)
  if (sg.need.length) console.log(`    전부 덮으려면: --entry ${sg.need.join(',')}`)
  console.log()
} else if (clo.internal.size < allNames.length) {
  console.log(`  ✓ 폐쇄 밖 읽기 없음 (도달 ${clo.internal.size}/${allNames.length} ${UNIT})\n`)
}

console.log('── 읽는 표 · WHERE 조건 ' + '─'.repeat(56))
console.log(`  ${pad('표', 24)}${pad('지점', 6)}WHERE 컬럼 (합집합)`)
for (const [t, rs] of [...byT.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  const cols = [...new Set(rs.flatMap((r) => r.where))]
  console.log(`  ${pad(t.length > 22 ? t.slice(0, 21) + '…' : t, 24)}${pad(rs.length, 6)}${cols.join(', ') || '(조건 없음)'}`)
}

if (rd.unresolved && rd.unresolved.length) {
  console.log(`\n  ⚠ 이 파일에 정의가 없는 레코드 참조 ${rd.unresolved.length}건. 그만큼 읽기가 덜 세어졌다`)
  console.log('    ' + rd.unresolved.slice(0, 6).join(' · ') + (rd.unresolved.length > 6 ? ' …' : ''))
}

console.log('\n── 지점별 ' + '─'.repeat(68))
for (const r of rd) {
  console.log(`  ${pad(r.fn + ':' + r.line, 24)}${pad(r.tables.join(','), 26)}${r.via}`)
  if (r.where.length) console.log(`    WHERE ${r.where.join(', ')}${r.order ? '   ORDER BY ' + r.order : ''}`)
  if (arg('cond')) {
    const cs = conditionsAt(ast, r.fn, r.line) || []
    if (cs.length) console.log('    실행 조건: ' + cs.map((c) => `${c.kind}(${c.text.slice(0, 44)})${c.branch ? '→' + c.branch : ''}`).join(' · '))
  }
  if (arg('sql') && r.sql) console.log('    SQL: ' + r.sql.slice(0, 220))
}
if (arg('cond')) {
  const warn = dialect.conditionWarning && dialect.conditionWarning(ast)
  if (warn) console.log(`\n  ⚠ ${warn}`)
}
console.log()
