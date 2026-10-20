#!/usr/bin/env node
/**
 * asis-tobe-diff.js — AS-IS 읽기 조건과 TO-BE 쿼리 조건을 **이름을 맞춘 뒤** 대조한다.
 * 두 원장을 눈으로 맞대면 이름이 달라(VIEW.COL ↔ tobe_table.column) 그 단계에서 오독이 난다.
 * asis-tobe-map 으로 같은 이름으로 만든 뒤 표 단위 차집합을 낸다.
 *
 *   node packs/modernization/bin/asis-tobe-diff.js --asis <파일> --entry <이름>[,...] --tobe <TO-BE 쿼리 파일> \
 *        [--method m] [--tobe-tool <추출기.js>]
 *        [--variant v] [--view-dir d] [--mapping p] [--canonical f] [--schema-dir d]   (asis-tobe-map 에 그대로 넘긴다)
 *
 * TO-BE 쪽 추출기: 기본 packs/stack-spring/bin/query-predicates.js (stack-spring 팩, 선택). 없으면 --tobe-tool 로
 * `<파일> --json` 에 {results:[{method, columns:["table.col"], raw?:{cols:[]}}]} 를 내는 스크립트를 준다.
 * 조건이 같다고 동작이 같은 것은 아니다 — 분기·정렬·조인 방향은 직접 본다.
 */
'use strict'
const fs = require('fs')
const path = require('path')
const cp = require('child_process')
const { config, wsPath, arg } = require(path.join(__dirname, 'asis-config.js'))

const asis = arg('asis')
const entry = arg('entry')
const tobe = arg('tobe')
if (!asis || !entry || !tobe || [asis, entry, tobe].includes(true)) {
  console.error('사용법: node packs/modernization/bin/asis-tobe-diff.js --asis <파일> --entry <이름>[,...] --tobe <쿼리 파일> [--method m] [--variant v] [--tobe-tool x.js]')
  process.exit(2)
}

/** TO-BE 추출기 — --tobe-tool > vars.asis.tobeQueryTool > 워크스페이스 packs/stack-spring > 킷 옆 stack-spring */
function tobeTool() {
  const cands = [arg('tobe-tool', null), config().asis.tobeQueryTool]
    .filter((x) => x && x !== true).map(wsPath)
    .concat([
      path.join(config().root, 'packs', 'stack-spring', 'bin', 'query-predicates.js'),
      path.join(__dirname, '..', '..', 'stack-spring', 'bin', 'query-predicates.js'),
    ])
  const hit = cands.find((p) => fs.existsSync(p))
  if (!hit) {
    console.error('✖ TO-BE 쿼리 추출기를 못 찾았다. stack-spring 팩을 워크스페이스에 추가하거나(packs/stack-spring/bin/query-predicates.js)')
    console.error('  --tobe-tool <스크립트> 또는 vars.asis.tobeQueryTool 로 지정하세요. 찾아본 곳:\n    ' + cands.join('\n    '))
    process.exit(2)
  }
  return hit
}

// 매핑 옵션은 asis-tobe-map 에 그대로 넘긴다
const passthrough = []
for (const k of ['variant', 'view-dir', 'mapping', 'canonical', 'schema-dir']) {
  const v = arg(k, null)
  if (v && v !== true) passthrough.push('--' + k, v)
}
const run = (script, args) => JSON.parse(cp.execFileSync(process.execPath, [script, ...args], { encoding: 'utf8', maxBuffer: 1e8 }))
const B = __dirname

const aj = run(path.join(B, 'asis-reads.js'), [asis, '--entry', entry, '--json'])
const tj = run(tobeTool(), [tobe, '--json'])

/** AS-IS `VIEW.COL` 을 TO-BE `table.column` 으로 바꾼다 (실패하면 null). */
const cache = new Map()
function toTobe(view, col) {
  const key = view + '.' + col
  if (cache.has(key)) return cache.get(key)
  let out = null
  try {
    const r = run(path.join(B, 'asis-tobe-map.js'), [key, ...passthrough, '--json'])
    const last = r.chain && r.chain[r.chain.length - 1]
    out = last && last.tobe ? last.tobe : null
  } catch (e) {
    out = null
  }
  cache.set(key, out)
  return out
}

// AS-IS: 표별 WHERE 컬럼 → TO-BE 이름
const asisByTable = new Map()
const unmapped = []
for (const r of aj.reads) {
  for (const v of r.tables) {
    for (const c of r.where) {
      const m = toTobe(v, c)
      if (!m) {
        unmapped.push(`${v}.${c}`)
        continue
      }
      const [t, col] = m.split('.')
      if (!asisByTable.has(t)) asisByTable.set(t, new Set())
      asisByTable.get(t).add(col)
    }
  }
}

// TO-BE: 표별 WHERE 컬럼
const only = arg('method', null)
const tobeByTable = new Map()
for (const r of tj.results || []) {
  if (only && only !== true && r.method !== only) continue
  const cols = [...(r.columns || []), ...((r.raw && r.raw.cols && r.raw.cols.map((c) => '?.' + c)) || [])]
  for (const c of cols) {
    const [t, col] = c.split('.')
    if (!tobeByTable.has(t)) tobeByTable.set(t, new Set())
    tobeByTable.get(t).add(col)
  }
}

if (arg('json')) {
  const obj = {}
  for (const t of new Set([...asisByTable.keys(), ...tobeByTable.keys()])) {
    const a = asisByTable.get(t) || new Set()
    const b = tobeByTable.get(t) || new Set()
    obj[t] = { both: [...a].filter((x) => b.has(x)), asisOnly: [...a].filter((x) => !b.has(x)), tobeOnly: [...b].filter((x) => !a.has(x)) }
  }
  console.log(JSON.stringify({ asisEntry: aj.entry, outsideClosure: (aj.outsideClosure || []).length, unmapped: [...new Set(unmapped)], tables: obj }, null, 2))
  return // process.exit 은 파이프로 나가는 긴 출력을 자른다
}

const pad = (s, n) => String(s).padEnd(n)
console.log(`\n■ AS-IS ${path.basename(asis)} (${aj.entry})   ↔   TO-BE ${path.basename(tobe)}${only && only !== true ? '#' + only : ''}`)
if (aj.outsideClosure && aj.outsideClosure.length) console.log(`  ⚠ AS-IS 폐쇄 밖 읽기 ${aj.outsideClosure.length}건. 진입점을 넓히지 않으면 대조가 반쪽이다`)
if (unmapped.length) console.log(`  ⚠ TO-BE 이름으로 못 바꾼 AS-IS 조건 ${unmapped.length}건: ${[...new Set(unmapped)].slice(0, 8).join(', ')}`)

const tables = [...new Set([...asisByTable.keys(), ...tobeByTable.keys()])].filter((t) => t !== '?').sort()
console.log('\n' + '─'.repeat(84))
for (const t of tables) {
  const a = asisByTable.get(t) || new Set()
  const b = tobeByTable.get(t) || new Set()
  const both = [...a].filter((x) => b.has(x))
  const aOnly = [...a].filter((x) => !b.has(x))
  const bOnly = [...b].filter((x) => !a.has(x))
  const mark = !a.size ? '  (AS-IS 미읽음)' : !b.size ? '  (TO-BE 미읽음)' : aOnly.length || bOnly.length ? '  ⚠ 차이' : '  ✓ 일치'
  console.log(`\n  ${pad(t, 26)}${mark}`)
  if (both.length) console.log(`    공통      : ${both.join(', ')}`)
  if (aOnly.length) console.log(`    AS-IS 만  : ${aOnly.join(', ')}`)
  if (bOnly.length) console.log(`    TO-BE 만  : ${bOnly.join(', ')}`)
}
if (tobeByTable.has('?')) console.log(`\n  ⚠ 표를 못 정한 TO-BE 조건(네이티브 SQL 등): ${[...tobeByTable.get('?')].join(', ')}. 직접 읽는다`)
console.log('\n  조건이 같다고 동작이 같은 것은 아니다. 분기·정렬·조인 방향은 직접 확인한다.\n')
