#!/usr/bin/env node
/**
 * asis-tobe-map.js — AS-IS 뷰/테이블·컬럼을 TO-BE 테이블·컬럼으로 잇는다.
 * asis-reads.js 가 낸 `VIEW.COL` 을 `tobe_table.column` 으로 바꿔 TO-BE 쿼리 추출 결과와 **같은 이름으로** 대조하려는 것이다.
 *
 *   node packs/modernization/bin/asis-tobe-map.js <VIEW|TABLE>[.<COLUMN>] [옵션]
 *     --where               그 뷰의 WHERE 를 조인 조건 / 필터 조건으로 갈라서 낸다
 *     --variant <이름>       뷰 정의 하위 폴더(국가·법인 등). 기본 vars.asis.viewVariant
 *     --view-dir <경로>      기본 vars.asis.viewDir
 *     --mapping <경로,…>     마이그레이션 스텝 YAML 파일·폴더. 기본 vars.asis.mappingSources
 *     --canonical <파일명>   스텝이 겹칠 때 우선할 정본 YAML. 기본 vars.asis.mappingCanonical
 *     --schema-dir <경로>    TO-BE DDL(*.sql) 폴더 — 실재 테이블만 대상으로 고른다. 기본 vars.asis.tobeSchemaDir
 *     --json                기계 판독용
 *
 * 체인: 뷰 정의(위치 대응) → 베이스 테이블.컬럼 → 마이그레이션 스텝 source_sql(`AS-IS AS tobe`) → TO-BE
 * 입력 형식: docs/asis-tools.md §매핑 입력 형식
 */
'use strict'
const fs = require('fs')
const path = require('path')
const { config, wsPath, pathList, arg } = require(path.join(__dirname, 'asis-config.js'))

const cfg = config().asis
const val = (flag, key) => {
  const v = arg(flag, null)
  return v && v !== true ? v : cfg[key]
}
const VARIANT = val('variant', 'viewVariant') || ''
const VIEW_BASE = wsPath(val('view-dir', 'viewDir'))
const VIEW_DIR = VIEW_BASE ? (VARIANT ? path.join(VIEW_BASE, VARIANT) : VIEW_BASE) : null
const MAPPING = pathList(val('mapping', 'mappingSources'))
const CANON = val('canonical', 'mappingCanonical') || ''
const SCHEMA_DIR = wsPath(val('schema-dir', 'tobeSchemaDir'))

/**
 * 뷰 정의 파싱 — 세 형태를 모두 읽는다. 파일은 .sql 이거나 ```sql 블록을 담은 .md.
 *   A) CREATE VIEW X(c1,c2) AS SELECT e1,e2 FROM …   → 위치 대응
 *   B) CREATE VIEW X AS SELECT * FROM base           → 그대로 통과(pass-through)
 *   C) CREATE VIEW X AS SELECT c1,c2 FROM base       → 이름 그대로
 */
function parseView(file) {
  let src = fs.readFileSync(file, 'latin1').replace(/\r/g, '')
  if (file.toLowerCase().endsWith('.sql')) src = src.replace(/\s*$/, '') + '\n```'
  const mv = /CREATE\s+VIEW\s+([\w."]+)\s*(\(([\s\S]*?)\))?\s*AS\s*\n\s*SELECT\s*\n([\s\S]*?)\n\s*FROM\s*\n([\s\S]*?)(?:\n\s*WHERE\s*\n([\s\S]*?))?;?\n?```/i.exec(src)
  if (!mv) return null
  const name = mv[1].replace(/"/g, '').split('.').pop()
  const selectBody = mv[4].replace(/"/g, '')
  const fromBody = mv[5].replace(/"/g, '')
  const where = (mv[6] || '').replace(/\s+/g, ' ').trim()
  const KW = new Set(['ON', 'AND', 'OR', 'WHERE', 'SELECT', 'FROM', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER', 'CROSS', 'AS', 'GROUP', 'ORDER', 'BY', 'UNION', 'IS', 'NOT', 'NULL', 'IN'])
  const from = new Map()
  // JOIN … ON 절을 떼어내야 ON/AND 가 테이블명으로 잡히지 않는다
  const fromClause = fromBody.split(/\bON\b/i)[0]
  for (const x of fromClause.matchAll(/([\w.]+)\s+([A-Z]\w*)\s*,?/g)) {
    const tbl = x[1].split('.').pop()
    if (KW.has(x[2].toUpperCase()) || KW.has(tbl.toUpperCase())) continue
    from.set(x[2], tbl)
  }
  const bases = [...fromClause.matchAll(/([\w.]+?)(?:\s+[A-Z]\w*)?\s*,?\s*$/gm)]
    .map((x) => x[1].split('.').pop()).filter((x) => x && !KW.has(x.toUpperCase()))
  if (!from.size && bases.length) from.set('_', bases[0])

  // 최상위 콤마로만 나눈다 (DECIMAL(a, 5, 0) 안의 콤마는 무시)
  const split = (t) => {
    const out = []
    let depth = 0
    let cur = ''
    for (const ch of t) {
      if (ch === '(') depth++
      else if (ch === ')') depth--
      if (ch === ',' && depth === 0) {
        out.push(cur.trim())
        cur = ''
      } else cur += ch
    }
    if (cur.trim()) out.push(cur.trim())
    return out.filter(Boolean)
  }
  const exprs = split(selectBody)

  // B) SELECT * — 베이스 컬럼을 그대로 노출한다
  if (exprs.length === 1 && /^\*$/.test(exprs[0].replace(/[\s;]/g, ''))) {
    return { name, file, passthrough: [...from.values()][0] || null, columns: [], from, where }
  }
  const declared = mv[3] ? split(mv[3]) : null
  const columns = exprs.map((e, i) => {
    const refs = [...e.matchAll(/\b([A-Z]\w*)\.([A-Z_][A-Z0-9_]*)/g)].map((r) => ({ alias: r[1], col: r[2], table: from.get(r[1]) || [...from.values()][0] }))
    const bare = /^([A-Z_][A-Z0-9_]*)\s*$/.exec(e)
    if (!refs.length && bare) refs.push({ alias: null, col: bare[1], table: [...from.values()][0] })
    const viewCol = declared ? declared[i] : refs[0] ? refs[0].col : `col${i + 1}`
    return { view: viewCol, expr: e.length > 60 ? e.slice(0, 59) + '…' : e, refs, direct: refs.length === 1 && (!!bare || /^[A-Z]\w*\.[A-Z_][A-Z0-9_]*$/.test(e)) }
  })
  return { name, file, passthrough: null, columns, from, where }
}

function loadViews() {
  const map = new Map()
  if (!VIEW_DIR || !fs.existsSync(VIEW_DIR)) return map
  for (const f of fs.readdirSync(VIEW_DIR).filter((x) => /\.(md|sql)$/i.test(x))) {
    const v = parseView(path.join(VIEW_DIR, f))
    if (v) map.set(v.name.toUpperCase(), v)
  }
  return map
}

const SQL_FN = new Set(['RTRIM', 'CAST', 'INTEGER', 'DECIMAL', 'CHAR', 'VARCHAR', 'SUBSTR', 'COALESCE', 'TRIM', 'DATE', 'TIMESTAMP', 'SMALLINT', 'BIGINT', 'NULL', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'AS', 'SELECT', 'DISTINCT', 'MIN', 'MAX', 'SUM', 'COUNT', 'INT', 'MOD'])

/** TO-BE 실 DDL 의 테이블 이름. 못 읽으면 null (필터를 끈다). */
function loadSchemaTables() {
  if (!SCHEMA_DIR || !fs.existsSync(SCHEMA_DIR)) return null
  const set = new Set()
  for (const f of fs.readdirSync(SCHEMA_DIR).filter((x) => x.endsWith('.sql'))) {
    const src = fs.readFileSync(path.join(SCHEMA_DIR, f), 'utf8')
    for (const m of src.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"?\w+"?\.)?"?(\w+)"?/gi)) set.add(m[1].toLowerCase())
  }
  return set.size ? set : null
}

/** mappingSources — 폴더면 그 안의 *.yaml|*.yml (하위 폴더 제외), 파일이면 그 파일. */
function mappingFiles() {
  const out = []
  for (const p of MAPPING) {
    if (!fs.existsSync(p)) continue
    if (fs.statSync(p).isDirectory()) {
      for (const f of fs.readdirSync(p).filter((x) => /\.ya?ml$/.test(x)).sort()) out.push(path.join(p, f))
    } else out.push(p)
  }
  return out
}

/**
 * 마이그레이션 스텝 — `target_table` 과 source_sql 의 `AS-IS AS tobe` 별칭을 모은다.
 * 한 AS-IS 표를 읽는 스텝이 여럿이면 1:1 적재 스텝 하나를 고르고, 컬럼도 그 스텝 대상표의 것만 쓴다
 * (파일 순서로 마지막 스텝이 이기면 키 추출용 보조 스텝으로 잘못 이어진다).
 */
function loadSteps() {
  const map = new Map() // ASIS_TABLE -> {target, cols: Map(ASIS_COL -> tobe_col)}
  const schema = loadSchemaTables()
  const cands = new Map() // ASIS_TABLE -> [step]
  for (const file of mappingFiles()) {
    const f = path.basename(file)
    const src = fs.readFileSync(file, 'utf8')
    for (const blk of src.split(/\n(?=-\s+(?:seq|name):)/)) {
      const mn = /name:\s*'([^']*)'|name:\s*"([^"]*)"|name:\s*(.+)/.exec(blk)
      const mt = /target_table:\s*([\w.]+)/.exec(blk)
      const ms = /source_sql:\s*\|-?\n([\s\S]*?)(?:\n {0,2}[a-z_]+:|$)/.exec(blk)
      if (!mt || !ms) continue
      const title = ((mn && (mn[1] || mn[2] || mn[3])) || '').trim()
      const exact = (/\(([A-Z0-9_]+)\)/.exec(title) || [])[1]
      const asis = exact || (/FROM\s+[\w.]*?([A-Z0-9_]+)/i.exec(ms[1]) || [])[1]
      if (!asis) continue
      const cols = new Map()
      for (const line of ms[1].split('\n')) {
        const ma = /\s+AS\s+([a-z_][a-z0-9_]*)\s*,?\s*$/.exec(line)
        if (!ma) continue
        const lhs = line.slice(0, ma.index)
        if (/^\s*'/.test(lhs) || /CURRENT\s+TIMESTAMP/i.test(lhs)) continue // 상수·시각
        const ids = [...lhs.matchAll(/\b([A-Z_][A-Z0-9_]{2,})\b/g)].map((x) => x[1]).filter((x) => !SQL_FN.has(x))
        if (!ids.length) continue
        if (!cols.has(ids[0])) cols.set(ids[0], ma[1])
      }
      const step = {
        target: mt[1],
        cols,
        // 순위: 정본 파일 → 제목이 `(AS-IS)` 로 딱 맞음 → 제목에 AS-IS 이름이 나옴 → 조인·서브쿼리 없음 → 컬럼 수
        rank: [CANON && f === CANON ? 1 : 0, exact ? 1 : 0, new RegExp(`\\b${asis}\\b`).test(title) ? 1 : 0,
          (ms[1].match(/\bFROM\b/gi) || []).length === 1 && !/\bJOIN\b/i.test(ms[1]) ? 1 : 0, cols.size],
        live: !schema || schema.has(mt[1].toLowerCase()),
      }
      if (!cands.has(asis)) cands.set(asis, [])
      cands.get(asis).push(step)
    }
  }
  const cmp = (a, b) => {
    for (let i = 0; i < a.rank.length; i++) if (a.rank[i] !== b.rank[i]) return b.rank[i] - a.rank[i]
    return 0
  }
  for (const [asis, list] of cands) {
    // 실 DDL 에 없는 대상표(폐기된 옛 테이블 등)는 다른 후보가 있으면 뺀다
    const live = list.filter((x) => x.live)
    const pool = (live.length ? live : list).sort(cmp)
    const target = pool[0].target
    const cols = new Map()
    for (const st of pool.filter((x) => x.target === target)) for (const [k, v] of st.cols) if (!cols.has(k)) cols.set(k, v)
    map.set(asis, { target, cols, others: [...new Set(pool.map((x) => x.target).filter((t) => t !== target))] })
  }
  return map
}

// ── CLI ──
const argv = process.argv.slice(2)
const has = (n) => argv.includes('--' + n)
const VALUED = new Set(['--variant', '--view-dir', '--mapping', '--canonical', '--schema-dir'])
const target = argv.find((a, i) => !a.startsWith('--') && !VALUED.has(argv[i - 1]))
if (!target) {
  console.error('사용법: node packs/modernization/bin/asis-tobe-map.js <VIEW|TABLE>[.<COLUMN>] [--where] [--variant v] [--json]')
  process.exit(2)
}
const views = loadViews()
const steps = loadSteps()
if (!views.size && !steps.size) {
  console.error(`  ⚠ 뷰 정의도 마이그레이션 스텝도 못 읽었다. vars.asis.viewDir(${VIEW_DIR || '미설정'}) · vars.asis.mappingSources(${MAPPING.join(',') || '미설정'}) 확인`)
  process.exit(1)
}
const TAG = VARIANT ? `, ${VARIANT}` : ''
const [objRaw, colRaw] = target.split('.')
const obj = objRaw.toUpperCase()
const col = colRaw ? colRaw.toUpperCase() : null

/** 같은 AS-IS 표를 읽는 다른 적재 스텝 — 고른 대상표가 유일한 답이 아닐 수 있음을 드러낸다. */
const others = (st) => (st.others && st.others.length ? `   (같은 표를 읽는 다른 스텝 대상: ${st.others.join(', ')})` : '')

/** 뷰 컬럼 → 베이스(테이블,컬럼) → TO-BE(테이블,컬럼) */
function resolve(objName, colName, depth = 0) {
  if (depth > 4) return { error: `뷰 체인이 너무 깊다: ${objName}` }
  const v = views.get(objName)
  if (v && v.passthrough) {
    const st = steps.get(v.passthrough)
    if (!st && views.has(v.passthrough.toUpperCase())) {
      // 베이스가 또 뷰다 — 한 단계 더 따라간다
      const inner = resolve(v.passthrough.toUpperCase(), colName, depth + 1)
      if (!inner.error) return { ...inner, kind: `뷰→뷰(${v.passthrough}) ` + inner.kind, chain: [{ base: `${v.passthrough}.${colName}`, tobe: null, target: null, via: '뷰' }, ...inner.chain] }
    }
    const t = st && st.cols.get(colName)
    return { kind: `뷰(pass-through → ${v.passthrough})`, chain: [{ base: `${v.passthrough}.${colName}`, tobe: t ? `${st.target}.${t}` : null, target: st ? st.target : null }] }
  }
  if (v) {
    const c = v.columns.find((x) => x.view.toUpperCase() === colName)
    if (!c) return { error: `뷰 ${objName} 에 컬럼 ${colName} 이 없다` }
    const chain = c.refs.map((r) => {
      const st = steps.get(r.table)
      if (!st && r.table && views.has(r.table.toUpperCase())) {
        const inner = resolve(r.table.toUpperCase(), r.col, depth + 1)
        if (!inner.error && inner.chain[inner.chain.length - 1].tobe) {
          const last = inner.chain[inner.chain.length - 1]
          return { base: `${r.table}.${r.col} → ${last.base}`, tobe: last.tobe, target: last.target }
        }
      }
      return { base: `${r.table}.${r.col}`, tobe: st && st.cols.get(r.col) ? `${st.target}.${st.cols.get(r.col)}` : null, target: st ? st.target : null }
    })
    return { kind: '뷰', expr: c.expr, direct: c.direct, chain }
  }
  const st = steps.get(objName)
  if (st) {
    const t = st.cols.get(colName)
    return { kind: '테이블', chain: [{ base: `${objName}.${colName}`, tobe: t ? `${st.target}.${t}` : null, target: st.target }] }
  }
  return { error: `${objName} 을 뷰·마이그레이션 스텝 어디에서도 못 찾았다 (뷰 ${views.size}개 · 스텝 ${steps.size}개 로드)` }
}

if (col) {
  const r = resolve(obj, col)
  if (has('json')) {
    console.log(JSON.stringify(r, null, 2))
  } else if (r.error) {
    console.error('  ⚠ ' + r.error)
    process.exitCode = 1
  } else {
    console.log(`\n■ ${obj}.${col}  (${r.kind}${TAG})`)
    if (r.expr) console.log(`  식: ${r.expr}${r.direct ? '' : '   ⚠ 가공식이라 1:1 이 아니다'}`)
    for (const c of r.chain) console.log(`  → ${c.base}` + (c.tobe ? `  →  ${c.tobe}` : `  →  (TO-BE 매핑 없음${c.target ? ', 대상표 ' + c.target : ''})`))
    console.log()
  }
} else {
  const v = views.get(obj)
  if (!v) {
    const st = steps.get(obj)
    if (!st) {
      console.error(`  ⚠ ${obj} 을 못 찾았다 (뷰 ${views.size}개 · 스텝 ${steps.size}개)`)
      process.exit(1)
    }
    console.log(`\n■ ${obj} (AS-IS 테이블) → ${st.target}   컬럼 ${st.cols.size}개${others(st)}`)
    for (const [a, b] of st.cols) console.log(`  ${a.padEnd(28)}→ ${b}`)
    console.log()
  } else if (v.passthrough) {
    const st = steps.get(v.passthrough)
    console.log(`\n■ ${obj} (뷰 pass-through${TAG}) → 베이스 ${v.passthrough}` + (st ? ` → ${st.target}  컬럼 ${st.cols.size}개${others(st)}` : '  (마이그레이션 스텝 없음)'))
    if (st) for (const [a, b] of st.cols) console.log(`  ${a.padEnd(28)}→ ${b}`)
    console.log()
  } else {
    console.log(`\n■ ${obj} (뷰${TAG})  베이스: ${[...new Set(v.from.values())].join(', ')}  컬럼 ${v.columns.length}개`)
    if (has('where')) {
      const parts = v.where.split(/\s+AND\s+/i).filter(Boolean)
      const join = parts.filter((p) => /^[A-Z]\w*\.\w+\s*=\s*[A-Z]\w*\.\w+$/.test(p.trim()))
      const filter = parts.filter((p) => !join.includes(p))
      console.log(`\n  조인 조건 ${join.length}개 / 필터 조건 ${filter.length}개`)
      if (filter.length) filter.forEach((f) => console.log('    필터: ' + f.trim()))
      else console.log('    ⚠ 필터 조건 없음: 이 뷰는 행을 거르지 않는다 (조인만)')
    }
    console.log()
    for (const c of v.columns) {
      const r = c.refs[0]
      const st = r && steps.get(r.table)
      const tobe = st && st.cols.get(r.col) ? `${st.target}.${st.cols.get(r.col)}` : null
      console.log(`  ${c.view.padEnd(20)}${(r ? r.table + '.' + r.col : '(상수·가공)').padEnd(30)}${tobe || ''}${c.direct ? '' : '  ⚠'}`)
    }
    console.log()
  }
}
