/**
 * EGL(.egl) 방언 — 함수 폐쇄 · 레코드↔테이블 · 쓰기/읽기/필드 쓰기 추출.
 * asis-dialect.js 가 확장자로 고른다. 단독 실행 대상 아님. 인터페이스는 docs/adding-a-dialect.md.
 */
'use strict'
const fs = require('fs')
const C = require('./_common.js')

/** 레거시 소스는 ISO-8859/확장 ASCII 가 섞여 있어 latin1 로 읽고 CR 을 턴다. */
function readLines(file) {
  return fs.readFileSync(file, 'latin1').split('\n').map((l) => l.replace(/\r$/, ''))
}

// 키워드 대소문자가 파일마다 섞여 있다(Function / function) — 대소문자를 가리면 그 파일이 조용히 0건이 된다
const RE_FN_START = /^function\s+([A-Za-z0-9_]+)\s*\(/i
const RE_FN_END = /^end\s*\/\/\s*end\s+([A-Za-z0-9_]+)/i
const RE_CALL = /\b([A-Za-z][A-Za-z0-9_]{2,})\s*\(\s*\)\s*;/g
const RE_REC = /^record\s+([A-Za-z0-9_]+)\s+type\s+sqlrecord/i
const RE_COL = /^\s*\d+\s+([A-Za-z0-9_]+)\s+[A-Za-z0-9_]+\s*\{[^}]*column\s*=\s*"([^"]+)"/
// `delete from` 은 #sql 안의 SQL 이지 EGL delete 문이 아니다 (레코드 이름을 FROM 으로 잡던 오탐)
const RE_WRITE = /^\s*(add|replace|delete)\s+(?!from\b)([A-Za-z0-9_]+)(.*)$/i
// #sql 블록을 한 줄로 이은 본문의 첫 문장 — 동사와 테이블이 줄바꿈으로 갈라져도 잡는다
const RE_SQL_LEAD = /^\s*(insert\s+into|update|delete(?:\s+from)?)\s+([A-Za-z_][A-Za-z0-9_]*)/i

/** 블록·라인 주석을 지운 판정용 사본. 문자열 리터럴은 건드리지 않는다. */
function stripComment(line) {
  return line.replace(/\/\*.*?\*\//g, ' ').replace(/\/\*.*$/, ' ').replace(/\/\/.*$/, ' ')
}

/**
 * 레코드의 tableNames 배열을 대괄호 균형으로 모은다. 세 형태가 섞여 있다:
 * 별도 줄 `tableNames = [["T","T1"]],` · 헤더 줄 `record X type sqlRecord{tableNames =[["T","T1"]` (다음 줄 `],`)
 * · 별칭 없는 `[["T"]]`. 헤더 줄 형태를 못 읽으면 그 레코드는 테이블 0개가 된다.
 */
function scanTables(rec, line) {
  let s = line
  if (!rec.tblOpen) {
    if (rec.tblDone) return false
    const m = /tablenames\s*=\s*\[/i.exec(line)
    if (!m) return false
    rec.tblOpen = true
    rec.tblDepth = 0
    rec.tblText = ''
    s = line.slice(m.index + m[0].length - 1)
  }
  for (const ch of s) {
    if (ch === '[') rec.tblDepth++
    else if (ch === ']' && --rec.tblDepth === 0) {
      rec.tblOpen = false
      rec.tblDone = true
      break
    }
    rec.tblText += ch
  }
  // 대소문자가 섞여 있다 — 한 표가 두 줄로 갈라지지 않게 대문자로 모은다
  if (rec.tblDone) for (const m of rec.tblText.matchAll(/\[\s*"([A-Za-z0-9_]+)"/g)) rec.tables.push(m[1].toUpperCase())
  return true
}

/** 파일을 파싱해 함수 범위 · 호출 그래프 · 레코드 정의를 만든다. */
function parse(file) {
  const lines = readLines(file)
  const fns = new Map() // name -> {name, start, end, calls:[{name,line}]}
  const records = new Map() // name -> {name, tables:[], columns:Map(field->column), line}

  let cur = null
  let rec = null
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const n = i + 1
    const s = stripComment(raw)

    const mFn = RE_FN_START.exec(raw)
    if (mFn) {
      if (cur) cur.end = n - 1
      cur = { name: mFn[1], start: n, end: null, calls: [] }
      fns.set(cur.name, cur)
      rec = null
      continue
    }
    const mEnd = RE_FN_END.exec(raw)
    if (mEnd && cur && mEnd[1] === cur.name) {
      cur.end = n
      cur = null
      continue
    }

    const mRec = RE_REC.exec(raw)
    if (mRec) {
      rec = { name: mRec[1], tables: [], columns: new Map(), line: n }
      records.set(rec.name, rec)
    }
    if (rec) {
      // 헤더 줄에 붙은 tableNames · 다음 줄 `], defaultSelectCondition` 도 같은 줄에서 이어 판정한다
      const hit = scanTables(rec, raw)
      if ((mRec || hit) && !/defaultselectcondition\s*=/i.test(raw)) continue
      if (/defaultselectcondition\s*=/i.test(raw)) {
        rec.condLine = n
        rec.cond = ''
        rec.inCond = true
        continue
      }
      if (rec.inCond) {
        if (/^\s*\}/.test(raw)) rec.inCond = false
        else rec.cond += ' ' + stripComment(raw).trim()
        continue
      }
      const mC = RE_COL.exec(raw)
      if (mC) {
        rec.columns.set(mC[1], mC[2])
        continue
      }
      // `end // end X` 처럼 주석이 붙은 끝줄도 레코드를 닫는다
      if (/^\s*end\s*;?\s*$/.test(s) || RE_FN_START.test(raw)) rec = null
    }

    if (cur) {
      RE_CALL.lastIndex = 0
      let m
      while ((m = RE_CALL.exec(s)) !== null) {
        if (m[1] === cur.name) continue
        cur.calls.push({ name: m[1], line: n })
      }
    }
  }
  if (cur && cur.end === null) cur.end = lines.length

  return { dialect: 'egl', file, lines, fns, records }
}

function closure(ast, entries) {
  return C.closure(ast, entries, { unit: '함수', hint: '키워드 대소문자(Function/function) · 인코딩 · EGL 이 맞는지' })
}

/** 폐쇄 안의 DB 쓰기(add/replace/delete + 인라인 SQL)를 전부 모은다. */
function effects(ast, clo) {
  const out = []
  for (const name of clo.order) {
    const f = ast.fns.get(name)
    const blocks = new Map(sqlWriteBlocks(ast, f.start, f.end).map((b) => [b.start, b]))
    const body = new Set() // #sql 블록의 첫 줄 뒤 — SQL 이라 EGL 동사 판정에서 뺀다
    for (const b of blocks.values()) for (let k = b.start + 1; k <= b.end; k++) body.add(k)
    let pending = null // 끝나지 않은 add/replace/delete — 바로 뒤 #sql 은 같은 문장이다
    for (let n = f.start; n <= f.end; n++) {
      const raw = ast.lines[n - 1]
      const s = stripComment(raw)
      const b = blocks.get(n)

      if (!body.has(n)) {
        const head = b ? s.slice(0, s.toLowerCase().indexOf('#sql')) : s
        const mW = RE_WRITE.exec(head)
        if (mW) {
          const rec = ast.records.get(mW[2])
          const e = {
            fn: name,
            seq: clo.internal.get(name),
            line: n,
            kind: { add: 'INSERT', replace: 'UPDATE', delete: 'DELETE' }[mW[1].toLowerCase()],
            record: mW[2],
            tables: rec ? [...rec.tables] : [],
            text: raw.trim(),
          }
          out.push(e)
          // `add X;` 는 여기서 끝난 문장 — 뒤따르는 별개의 execute #sql 을 이 문장에 흡수하면 쓰기를 놓친다
          pending = /;/.test(mW[3]) && !/\bwith\b/i.test(mW[3]) ? null : e
        }
      }

      if (b) {
        if (b.write) {
          // add X with #sql{ insert into T } 는 한 문장 — 실제로 쓰는 표는 SQL 의 표다
          if (pending && n - pending.line <= 3) pending.tables = [b.write.table]
          else out.push({ fn: name, seq: clo.internal.get(name), line: b.write.line, kind: b.write.kind, record: null, tables: [b.write.table], text: ast.lines[b.write.line - 1].trim() })
        }
        pending = null
        n = b.end
        continue
      }
      if (pending && n - pending.line > 3) pending = null
    }
  }
  return out.sort((a, b) => a.seq - b.seq || a.line - b.line)
}

/** #sql 블록마다 첫 문장이 쓰기면 {kind, table, line} 을 붙인다. SQL `--` 주석은 잇기 전에 턴다. */
function sqlWriteBlocks(ast, from, to) {
  return sqlBlocks(ast, from, to).map((b) => {
    let text = ''
    const at = []
    for (let k = b.start; k <= b.end; k++) {
      let l = ast.lines[k - 1]
      if (k === b.start) l = l.slice(l.indexOf('{', l.toLowerCase().indexOf('#sql')) + 1)
      at.push([text.length, k])
      text += stripComment(l).replace(/--.*$/, ' ') + ' '
    }
    const m = RE_SQL_LEAD.exec(text)
    if (!m) return b
    const pos = m.index + m[0].search(/\S/)
    let line = b.start
    for (const [off, k] of at) if (off <= pos) line = k
    const verb = m[1].toLowerCase().split(/\s+/)[0]
    return { ...b, write: { kind: { insert: 'INSERT', update: 'UPDATE', delete: 'DELETE' }[verb], table: m[2].toUpperCase(), line } }
  })
}

/** #sql{ … } 블록을 중괄호 균형으로 잘라낸다. */
function sqlBlocks(ast, from, to) {
  const out = []
  for (let n = from; n <= to; n++) {
    const line = ast.lines[n - 1]
    const i = line.toLowerCase().indexOf('#sql')
    if (i === -1) continue
    const open = line.indexOf('{', i)
    if (open === -1) continue
    let depth = 0
    let text = ''
    let end = n
    outer: for (let k = n; k <= Math.min(to + 40, ast.lines.length); k++) {
      const l = k === n ? line.slice(open) : ast.lines[k - 1]
      for (const ch of l) {
        if (ch === '{') depth++
        else if (ch === '}') {
          depth--
          if (depth === 0) {
            end = k
            break outer
          }
        } else if (depth > 0) text += ch
      }
      text += ' '
    }
    out.push({ start: n, end, text: text.replace(/\s+/g, ' ').trim() })
    n = end
  }
  return out
}

/** 폐쇄 안의 읽기(SELECT · 커서 오픈 · defaultSelectCondition 경유 get)를 모은다. */
function reads(ast, clo) {
  const out = []
  for (const name of clo.order) {
    const f = ast.fns.get(name)
    const blocks = sqlBlocks(ast, f.start, f.end)
    const covered = new Set()
    for (const b of blocks) {
      for (let k = b.start; k <= b.end; k++) covered.add(k)
      if (!/^\s*select\b/i.test(b.text)) continue
      const tables = [...b.text.matchAll(/\bFROM\s+([A-Z0-9_]+)|\bJOIN\s+([A-Z0-9_]+)/gi)].map((m) => (m[1] || m[2]).toUpperCase())
      out.push({
        fn: name,
        seq: clo.internal.get(name),
        line: b.start,
        tables: [...new Set(tables)],
        where: C.whereColumns(b.text),
        order: (/\bORDER\s+BY\b([^}]*)$/i.exec(b.text) || [, ''])[1].trim().slice(0, 40),
        via: '인라인 SQL',
        sql: b.text,
      })
    }
    // 인라인 SQL 없는 get/open — 레코드의 defaultSelectCondition 이 조건이다
    for (let n = f.start; n <= f.end; n++) {
      if (covered.has(n)) continue
      const m = /^\s*(?:get|open)\s+(?:next\s+)?([A-Za-z0-9_]+)/i.exec(stripComment(ast.lines[n - 1]))
      if (!m) continue
      if (/with\b/i.test(ast.lines[n - 1]) || /with\b/i.test(ast.lines[n] || '')) continue
      const rec = ast.records.get(m[1])
      if (!rec || !rec.tables.length) {
        // 이 파일에 정의가 없는 레코드 — 조용히 빠뜨리지 않고 신고한다
        ;(out.unresolved || (out.unresolved = [])).push(`${name}:${n} ${m[1]}`)
        continue
      }
      out.push({
        fn: name,
        seq: clo.internal.get(name),
        line: n,
        tables: [...rec.tables],
        where: rec.cond ? C.whereColumns('WHERE ' + rec.cond) : [],
        order: '',
        via: rec.cond ? `defaultSelectCondition(${rec.name})` : `레코드 기본(${rec.name})`,
        sql: rec.cond || '',
      })
    }
  }
  const unresolved = out.unresolved
  const sorted = out.sort((a, b) => a.seq - b.seq || a.line - b.line)
  if (unresolved) sorted.unresolved = unresolved
  return sorted
}

/**
 * 한 필드의 쓰기 — `REC.FIELD = 식;` · `set REC empty;` · `move A to REC;`.
 * opt.keep(레코드명) 으로 레코드를 거른다 (--record / --table).
 */
function fieldWrites(ast, clo, FLD, opt = {}) {
  const keep = opt.keep || (() => true)
  const reAssign = new RegExp(`\\b([A-Za-z0-9_]+)\\.(${FLD})\\s*=\\s*([^;]+);`, 'i')
  const reClear = /^\s*set\s+([A-Za-z0-9_]+)\s+(empty)\s*;/i
  const reMove = /^\s*move\s+([A-Za-z0-9_]+)\s+to\s+([A-Za-z0-9_]+)/i
  const sites = []
  for (const name of clo.order) {
    const f = ast.fns.get(name)
    for (let n = f.start; n <= f.end; n++) {
      const s = stripComment(ast.lines[n - 1])
      let m
      if ((m = reAssign.exec(s))) {
        if (!keep(m[1])) continue
        sites.push({ seq: clo.internal.get(name), fn: name, line: n, rec: m[1], how: '대입', expr: m[3].trim() })
        continue
      }
      if ((m = reClear.exec(s))) {
        if (!keep(m[1])) continue
        const rec = ast.records.get(m[1])
        if (!rec || !rec.columns.has(FLD)) continue
        sites.push({ seq: clo.internal.get(name), fn: name, line: n, rec: m[1], how: '초기화', expr: 'set … empty (전 필드)' })
        continue
      }
      if ((m = reMove.exec(s))) {
        if (!keep(m[2])) continue
        const dst = ast.records.get(m[2])
        if (!dst || !dst.columns.has(FLD)) continue
        sites.push({ seq: clo.internal.get(name), fn: name, line: n, rec: m[2], how: '통째복사', expr: `move ${m[1]} to ${m[2]} (전 필드)` })
      }
    }
  }
  return sites.sort((a, b) => a.seq - b.seq || a.line - b.line)
}

/** 그 라인을 감싸는 if/while 조건 스택 (실행 조건). */
function conditionsAt(ast, fnName, line) {
  const f = ast.fns.get(fnName)
  if (!f) return []
  const stack = []
  for (let n = f.start; n < line; n++) {
    const s = stripComment(ast.lines[n - 1]).trim()
    const m = /^(if|while|for|case)\s*\(?(.*)$/i.exec(s)
    if (m) {
      stack.push({ kind: m[1].toLowerCase(), text: m[2].replace(/\)\s*$/, '').trim(), line: n, branch: '' })
      continue
    }
    if (/^try\b/i.test(s)) {
      stack.push({ kind: 'try', text: '', line: n, branch: '' })
      continue
    }
    if (/^else\b/i.test(s) && stack.length) stack[stack.length - 1].branch = 'else'
    if (/^end\b/i.test(s)) stack.pop()
  }
  return stack.filter((x) => x.kind === 'if' || x.kind === 'while')
}

/** 조건 스택을 믿을 수 없는 파일이면 경고 문구, 아니면 null. EGL 은 블록이 end 로 닫혀 항상 신뢰한다. */
function conditionWarning() {
  return null
}

module.exports = {
  name: 'egl',
  extensions: ['.egl'],
  unit: '함수',
  label: '',
  writeTargets: '테이블',
  parse, closure, effects, reads, fieldWrites, conditionsAt, conditionWarning,
  // 내부 헬퍼 (테스트용)
  readLines, stripComment, sqlBlocks, whereColumns: C.whereColumns,
}
