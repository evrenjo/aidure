#!/usr/bin/env node
/**
 * asis-effects.js — 레거시(AS-IS) 프로그램의 "효과 폐쇄": 진입점에서 도달하는 함수·문단의 DB 쓰기를 테이블 단위로 집계한다.
 * "어느 표에 쓰는가" 를 사람 판단이 아니라 대조로 바꾸는 것이 목적이다.
 *
 *   node packs/modernization/bin/asis-effects.js <파일> --entry <이름|라인번호>[,...] [옵션]
 *     --opened a,b,c   이미 열어본 함수 (미개봉 목록에서 뺀다)
 *     --tobe t1,t2     TO-BE 가 쓰는 테이블 (대조표를 낸다)
 *     --calls          호출 트리도 출력
 *     --cond           각 쓰기의 실행 조건 스택
 *     --json           기계 판독용
 *
 * <파일> 은 경로 또는 vars.asis.sourceRoot 기준 상대 경로·파일명. 방언은 확장자로 고른다 (.egl · .cbl …).
 */
'use strict'
const path = require('path')
const pick = require(path.join(__dirname, 'asis-dialect.js'))
const C = require(path.join(__dirname, 'dialects', '_common.js'))
const { arg, resolveSource } = require(path.join(__dirname, 'asis-config.js'))

const given = process.argv[2]
if (!given || given.startsWith('--')) {
  console.error('사용법: node packs/modernization/bin/asis-effects.js <파일> --entry <이름|라인번호>[,...] [--opened a,b] [--tobe t1,t2] [--calls] [--cond] [--json]')
  process.exit(2)
}
let file
try {
  file = resolveSource(given)
} catch (e) {
  console.error(e.message)
  process.exit(2)
}
const entry = arg('entry')

const dialect = pick(file)
const { parse, closure, effects, conditionsAt } = dialect
const ast = parse(file)
const UNIT = dialect.unit

if (!entry || entry === true) {
  const r = C.roots(ast)
  console.error(`--entry 가 필요합니다. 아무도 부르지 않는 ${UNIT} (진입점 후보 ${r.length}개):`)
  for (let i = 0; i < Math.min(r.length, 24); i += 6) console.error('  ' + r.slice(i, i + 6).join('  '))
  if (r.length > 24) console.error(`  … 외 ${r.length - 24}개`)
  console.error(`\n  전부 주려면: --entry ${r.slice(0, 3).join(',')}${r.length > 3 ? ',…' : ''}`)
  process.exit(2)
}
const clo = closure(ast, String(entry).split(',').map((x) => x.trim()).filter(Boolean))
const eff = effects(ast, clo)

// 파일 전체 기준 효과와 비교해 폐쇄 밖에 남은 쓰기를 신고한다
const allNames = [...ast.fns.keys()]
const effAll = effects(ast, C.wholeFile(ast))
const inClo = new Set(eff.map((e) => `${e.fn}:${e.line}`))
const outside = effAll.filter((e) => !inClo.has(`${e.fn}:${e.line}`))

const opened = new Set(String(arg('opened', '')).split(',').map((s) => s.trim()).filter(Boolean))
const tobe = new Set(String(arg('tobe', '')).split(',').map((s) => s.trim().toUpperCase()).filter(Boolean))

// 테이블별 집계
const byTable = new Map()
for (const e of eff) {
  const tabs = e.tables.length ? e.tables : ['(레코드 정의 없음: ' + e.record + ')']
  for (const t of tabs) {
    if (!byTable.has(t)) byTable.set(t, [])
    byTable.get(t).push(e)
  }
}

if (arg('json')) {
  console.log(JSON.stringify({
    entry: clo.entry,
    internal: [...clo.internal.keys()],
    external: [...clo.external],
    unopened: [...clo.internal.keys()].filter((f) => !opened.has(f)),
    outsideClosure: outside.map((e) => ({ fn: e.fn, line: e.line, kind: e.kind, tables: e.tables })),
    effects: eff,
    tables: [...byTable.entries()].map(([t, es]) => ({ table: t, kinds: [...new Set(es.map((e) => e.kind))], sites: es.map((e) => `${e.fn}:${e.line}`) })),
  }, null, 2))
  return // process.exit 은 파이프로 나가는 긴 출력을 자른다
}

const pad = (s, n) => String(s).padEnd(n)
console.log(`\n■ 진입점: ${clo.entry}  (${path.basename(file)}${dialect.label ? ', ' + dialect.label : ''})`)
console.log(`■ ${UNIT} 폐쇄: 파일 내 ${clo.internal.size}개 / 외부 ${clo.external.size}개\n`)

console.log(`── 쓰기 대상 (${dialect.writeTargets || '테이블'}) ` + '─'.repeat(52))
const rows = [...byTable.entries()].sort((a, b) => a[0].localeCompare(b[0]))
console.log(`  ${pad('대상', 32)}${pad('효과', 23)}${tobe.size ? pad('TO-BE', 8) : ''}지점`)
for (const [t, es] of rows) {
  const kinds = [...new Set(es.map((e) => e.kind))].join(',')
  const mark = tobe.size ? (tobe.has(t.toUpperCase()) ? pad('O', 8) : pad('■ 없음', 8)) : ''
  console.log(`  ${pad(t.length > 30 ? t.slice(0, 29) + '…' : t, 32)}${pad(kinds, 23)}${mark}${es.map((e) => `${e.fn}:${e.line}`).join(' ')}`)
}
if (tobe.size) {
  const missing = rows.filter(([t]) => !tobe.has(t.toUpperCase())).map(([t]) => t)
  const extra = [...tobe].filter((t) => !rows.some(([r]) => r.toUpperCase() === t))
  console.log(`\n  ■ AS-IS 에 있고 TO-BE 에 없음: ${missing.length ? missing.join(', ') : '없음'}`)
  console.log(`  ■ TO-BE 에 있고 AS-IS 에 없음: ${extra.length ? extra.join(', ') : '없음'}`)
}

if (outside.length) {
  const outTabs = [...new Set(outside.flatMap((e) => e.tables))]
  console.log(`\n  ⚠ 폐쇄 밖 쓰기 ${outside.length}건. 진입점이 좁을 수 있습니다 (도달 ${clo.internal.size}/${allNames.length} ${UNIT})`)
  console.log(`    누락 후보 대상: ${outTabs.join(', ')}`)
  console.log(`    누락 후보 ${UNIT}: ${[...new Set(outside.map((e) => e.fn))].slice(0, 10).join(' ')}`)
  console.log(`    진입점 후보 전수: --entry ${C.roots(ast).slice(0, 4).join(',')}…`)
} else if (clo.internal.size < allNames.length) {
  console.log(`\n  ✓ 폐쇄 밖 쓰기 없음 (도달 ${clo.internal.size}/${allNames.length} ${UNIT}. 나머지는 쓰기가 없다)`)
}

if (arg('cond')) {
  console.log('\n── 쓰기별 실행 조건 ' + '─'.repeat(56))
  for (const e of eff) {
    const cs = conditionsAt(ast, e.fn, e.line) || []
    console.log(`  ${pad(e.fn + ':' + e.line, 24)}${pad(e.kind, 9)}${e.tables.join(',')}`)
    if (cs.length) console.log('    ' + cs.map((c) => `${c.kind}(${c.text.slice(0, 42)})${c.branch ? '→' + c.branch : ''}`).join(' · '))
  }
  const warn = dialect.conditionWarning && dialect.conditionWarning(ast)
  if (warn) console.log(`\n  ⚠ ${warn}`)
}

const unopened = [...clo.internal.keys()].filter((f) => !opened.has(f))
console.log(`\n── 미개봉 ${UNIT} ${unopened.length}/${clo.internal.size} ` + '─'.repeat(48))
if (!unopened.length) console.log('  없음: 폐쇄가 닫혔습니다')
else {
  for (let i = 0; i < unopened.length; i += 8) console.log('  ' + unopened.slice(i, i + 8).join(' '))
}
if (clo.external.size) {
  console.log(`\n── 외부 (이 파일에 정의 없음. CALL·미정의 ${UNIT}) ` + '─'.repeat(28))
  const ex = [...clo.external]
  for (let i = 0; i < ex.length; i += 8) console.log('  ' + ex.slice(i, i + 8).join(' '))
}

if (arg('calls')) {
  console.log('\n── 호출 트리 ' + '─'.repeat(62))
  const seen = new Set()
  ;(function tree(name, depth) {
    console.log('  ' + '  '.repeat(depth) + name + (seen.has(name) ? ' …' : ''))
    if (seen.has(name) || depth > 6 || !ast.fns.has(name)) return
    seen.add(name)
    for (const c of [...ast.fns.get(name).calls].sort((a, b) => a.line - b.line)) tree(c.name, depth + 1)
  })(clo.entry, 0)
}
console.log()
