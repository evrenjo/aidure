/**
 * COBOL(.cbl) 방언 — 문단 폐쇄 · EXEC SQL 쓰기/읽기 · 파일 WRITE/READ · 필드 쓰기 추출.
 * egl.js 와 같은 인터페이스를 낸다. 단독 실행 대상 아님.
 *
 * 고정형식 전제: 1-6 변경태그/시퀀스 · 7 지시자(* / 는 주석, $ 는 지시문) · 8-72 코드 · 73-80 식별.
 * 자유형식 소스는 이 파서로 못 읽는다 — 문단 0개면 예외를 던진다.
 */
'use strict'
const fs = require('fs')
const C = require('./_common.js')

const RE_PARA = /^ {0,3}([A-Z0-9][A-Z0-9-]*?)(\s+SECTION)?\s*\.(\s|$)/

/** PERFORM/GO TO 뒤에 올 수 있는 예약어 — 문단명이 아니다 (인라인 PERFORM 등). */
const RESERVED = new Set([
  'VARYING', 'UNTIL', 'WITH', 'TEST', 'FOREVER', 'TIMES', 'THRU', 'THROUGH', 'BEFORE', 'AFTER',
  'MOVE', 'IF', 'ELSE', 'ADD', 'SUBTRACT', 'COMPUTE', 'SET', 'READ', 'WRITE', 'OPEN', 'CLOSE',
  'DISPLAY', 'ACCEPT', 'EVALUATE', 'WHEN', 'EXIT', 'STOP', 'GOBACK', 'CONTINUE', 'INITIALIZE',
  'STRING', 'UNSTRING', 'INSPECT', 'SEARCH', 'SORT', 'CALL', 'GO', 'PERFORM', 'DIVIDE', 'MULTIPLY',
])
const isName = (n) => n && !RESERVED.has(n) && !n.startsWith('END-')
const RE_PERFORM = /\bPERFORM\s+([A-Z0-9][A-Z0-9-]*)(?:\s+(?:THRU|THROUGH)\s+([A-Z0-9][A-Z0-9-]*))?/g
const RE_GOTO = /\bGO\s+TO\s+([A-Z0-9][A-Z0-9-]*)/g
const RE_CALL = /\bCALL\s+['"]([A-Z0-9_-]+)['"]/g
const RE_SQL = /\bEXEC\s+SQL\b([\s\S]*?)\bEND-EXEC\b/g
const RE_SQL_WRITE = /^\s*(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+([A-Z0-9_.]+)/i
const RE_FILE_WRITE = /\b(WRITE|REWRITE)\s+([A-Z0-9][A-Z0-9-]*)/g
const RE_FD = /^ {0,3}FD\s+([A-Z0-9][A-Z0-9-]*)/
const RE_SELECT = /\bSELECT\s+([A-Z0-9][A-Z0-9-]*)\s+ASSIGN\s+TO\s+([A-Z0-9-]+)/g
const RE_01 = /^ {0,3}01\s+([A-Z0-9][A-Z0-9-]*)/

/** 주석·지시문을 빼고 코드 영역(8-72)만 남긴다. 원본 라인번호를 보존한다. */
function readCode(file) {
  const raw = fs.readFileSync(file, 'latin1').split('\n').map((l) => l.replace(/\r$/, ''))
  return raw.map((l, i) => {
    const ind = l.charAt(6)
    const dead = ind === '*' || ind === '/' || ind === '$'
    return { line: i + 1, code: dead ? '' : l.substring(7, 72), raw: l }
  })
}

/** 코드 라인을 한 줄로 잇고 오프셋→라인번호 표를 만든다 (문장이 여러 줄에 걸치므로). */
function join(code) {
  let text = ''
  const at = []
  for (const c of code) {
    if (!c.code.trim()) continue
    const piece = c.code.trimEnd() + ' '
    for (let k = 0; k < piece.length; k++) at.push(c.line)
    text += piece
  }
  return { text, at }
}

function parse(file) {
  const code = readCode(file)
  const lines = code.map((c) => c.raw)
  const fns = new Map()
  const records = new Map() // 레코드명 -> {name, tables:[파일명], columns:Map} (WRITE 대상 파일)

  // PROCEDURE DIVISION 이후만 절차부
  let procAt = 0
  for (const c of code) {
    if (/\bPROCEDURE\s+DIVISION\b/.test(c.code)) {
      procAt = c.line
      break
    }
  }

  // FD / SELECT — 레코드 ↔ 파일
  const fdFile = []
  for (const c of code) {
    if (c.line >= procAt && procAt) break
    const mF = RE_FD.exec(c.code)
    if (mF) {
      fdFile.push(mF[1])
      continue
    }
    const m01 = RE_01.exec(c.code)
    if (m01 && fdFile.length) {
      records.set(m01[1], { name: m01[1], tables: [fdFile[fdFile.length - 1]], columns: new Map(), line: c.line })
      fdFile.length = 0
    }
  }
  const assign = new Map()
  {
    const j = join(code.filter((c) => !procAt || c.line < procAt))
    let m
    RE_SELECT.lastIndex = 0
    while ((m = RE_SELECT.exec(j.text)) !== null) assign.set(m[1], m[2])
  }
  for (const r of records.values()) r.assign = assign.get(r.tables[0]) || null

  // 문단 경계
  const paras = []
  for (const c of code) {
    if (c.line <= procAt || !c.code.trim()) continue
    const m = RE_PARA.exec(c.code)
    if (m && isName(m[1]) && !/^(PROCEDURE|DECLARATIVES)$/.test(m[1])) paras.push({ name: m[1], start: c.line })
  }
  paras.forEach((p, i) => {
    p.end = i + 1 < paras.length ? paras[i + 1].start - 1 : code.length
  })
  const order = paras.map((p) => p.name)
  for (const p of paras) fns.set(p.name, { name: p.name, start: p.start, end: p.end, calls: [] })

  /** PERFORM A THRU B — 소스 순서로 A~B 사이 문단 전부가 실행된다. */
  const expandThru = (a, b) => {
    const ia = order.indexOf(a)
    const ib = order.indexOf(b)
    if (ia === -1 || ib === -1 || ib < ia) return [a, b].filter((n) => order.includes(n))
    return order.slice(ia, ib + 1)
  }

  for (const p of paras) {
    const j = join(code.filter((c) => c.line >= p.start && c.line <= p.end))
    const f = fns.get(p.name)
    for (const [re, kind] of [[RE_PERFORM, 'PERFORM'], [RE_GOTO, 'GOTO'], [RE_CALL, 'CALL']]) {
      re.lastIndex = 0
      let m
      while ((m = re.exec(j.text)) !== null) {
        const ln = j.at[m.index] || p.start
        if (kind !== 'CALL' && !isName(m[1])) continue
        if (kind === 'PERFORM' && m[2] && isName(m[2])) {
          for (const n of expandThru(m[1], m[2])) if (n !== p.name) f.calls.push({ name: n, line: ln, via: 'THRU' })
        } else if (m[1] !== p.name) {
          f.calls.push({ name: m[1], line: ln, via: kind })
        }
      }
    }
  }

  return { dialect: 'cobol', file, lines, code, fns, records, procAt, order }
}

function closure(ast, entries) {
  return C.closure(ast, entries, { unit: '문단', normalize: (x) => x.toUpperCase(), hint: '고정형식(7열 지시자)인지 · PROCEDURE DIVISION 이 있는지' })
}

function effects(ast, clo) {
  const out = []
  for (const name of clo.order) {
    const f = ast.fns.get(name)
    const seg = ast.code.filter((c) => c.line >= f.start && c.line <= f.end)
    const j = join(seg)

    RE_SQL.lastIndex = 0
    let m
    while ((m = RE_SQL.exec(j.text)) !== null) {
      const body = m[1].trim()
      const w = RE_SQL_WRITE.exec(body)
      if (!w) continue
      const verb = /^INSERT/i.test(body) ? 'INSERT' : /^UPDATE/i.test(body) ? 'UPDATE' : 'DELETE'
      out.push({
        fn: name,
        seq: clo.internal.get(name),
        line: j.at[m.index] || f.start,
        kind: verb,
        record: null,
        tables: [w[1].toUpperCase()],
        text: body.slice(0, 60).replace(/\s+/g, ' '),
      })
    }

    RE_FILE_WRITE.lastIndex = 0
    while ((m = RE_FILE_WRITE.exec(j.text)) !== null) {
      const rec = ast.records.get(m[2])
      out.push({
        fn: name,
        seq: clo.internal.get(name),
        line: j.at[m.index] || f.start,
        kind: m[1] === 'WRITE' ? 'FILE WRITE' : 'FILE REWRITE',
        record: m[2],
        tables: [rec ? `${rec.tables[0]}${rec.assign ? ' (' + rec.assign + ')' : ''}` : `(FD 미상: ${m[2]})`],
        text: m[0],
      })
    }
  }
  return out.sort((a, b) => a.seq - b.seq || a.line - b.line)
}

/** 필드 쓰기 — MOVE/COMPUTE/INITIALIZE/ADD/SUBTRACT/SET. opt(레코드 필터)는 cobol 에서 쓰지 않는다. */
function fieldWrites(ast, clo, FLD) {
  const esc = FLD.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const reMove = new RegExp(`\\bMOVE\\s+([\\s\\S]{1,60}?)\\s+TO\\s+((?:[A-Z0-9-]+[\\s,]+)*?${esc})\\b`, 'i')
  const reComp = new RegExp(`\\bCOMPUTE\\s+${esc}\\s*(?:ROUNDED\\s*)?=\\s*([^.]{1,60})`, 'i')
  const reAdd = new RegExp(`\\b(ADD|SUBTRACT)\\s+([\\s\\S]{1,40}?)\\s+(?:TO|FROM)\\s+${esc}\\b`, 'i')
  const reInit = new RegExp(`\\b(INITIALIZE)\\s+${esc}\\b`, 'i')
  const reSet = new RegExp(`\\bSET\\s+${esc}\\s+TO\\s+([A-Z0-9-]+)`, 'i')
  const sites = []
  for (const name of clo.order) {
    const f = ast.fns.get(name)
    const j = join(ast.code.filter((c) => c.line >= f.start && c.line <= f.end))
    for (const [re, how] of [[reMove, 'MOVE'], [reComp, 'COMPUTE'], [reAdd, 'ADD/SUB'], [reInit, '초기화'], [reSet, 'SET']]) {
      const g = new RegExp(re.source, 'gi')
      let m
      while ((m = g.exec(j.text)) !== null) {
        sites.push({
          seq: clo.internal.get(name),
          fn: name,
          line: j.at[m.index] || f.start,
          rec: FLD,
          how,
          expr: m[0].replace(/\s+/g, ' ').slice(0, 70),
        })
      }
    }
  }
  return sites.sort((a, b) => a.seq - b.seq || a.line - b.line)
}

/** 커서 선언은 절차부 밖에 있다 — 파일 전체에서 미리 모은다 (EGL 의 레코드에 해당). */
function cursors(ast) {
  const map = new Map()
  const j = join(ast.code)
  for (const m of j.text.matchAll(/\bEXEC\s+SQL\s+DECLARE\s+([A-Z0-9-]+)\s+CURSOR\s+(?:WITH\s+\w+\s+)?FOR\s+([\s\S]*?)\bEND-EXEC\b/gi)) {
    const sql = m[2].replace(/\s+/g, ' ').trim()
    const tables = [...sql.matchAll(/\bFROM\s+([A-Z0-9_.]+)|\bJOIN\s+([A-Z0-9_.]+)/gi)].map((x) => (x[1] || x[2]).toUpperCase())
    map.set(m[1].toUpperCase(), { name: m[1].toUpperCase(), line: j.at[m.index] || 0, tables: [...new Set(tables)], where: C.whereColumns(sql), sql })
  }
  return map
}

/** 폐쇄 안의 읽기 — 커서 OPEN/FETCH · 단건 SELECT · 파일 READ. */
function reads(ast, clo) {
  const curs = ast._cursors || (ast._cursors = cursors(ast))
  const out = []
  for (const name of clo.order) {
    const f = ast.fns.get(name)
    const j = join(ast.code.filter((c) => c.line >= f.start && c.line <= f.end))

    for (const m of j.text.matchAll(/\bEXEC\s+SQL\s+([\s\S]*?)\bEND-EXEC\b/gi)) {
      const body = m[1].replace(/\s+/g, ' ').trim()
      const line = j.at[m.index] || f.start
      const mo = /^(OPEN|FETCH)\s+([A-Z0-9-]+)/i.exec(body)
      if (mo) {
        const c = curs.get(mo[2].toUpperCase())
        if (c) out.push({ fn: name, seq: clo.internal.get(name), line, tables: c.tables, where: c.where, order: '', via: `커서 ${c.name} (선언 ${c.line})`, sql: c.sql })
        continue
      }
      if (/^SELECT\b/i.test(body)) {
        const tables = [...body.matchAll(/\bFROM\s+([A-Z0-9_.]+)|\bJOIN\s+([A-Z0-9_.]+)/gi)].map((x) => (x[1] || x[2]).toUpperCase())
        out.push({ fn: name, seq: clo.internal.get(name), line, tables: [...new Set(tables)], where: C.whereColumns(body), order: '', via: '단건 SELECT', sql: body })
      }
    }

    for (const m of j.text.matchAll(/\bREAD\s+([A-Z0-9][A-Z0-9-]*)/g)) {
      out.push({ fn: name, seq: clo.internal.get(name), line: j.at[m.index] || f.start, tables: [`(파일) ${m[1]}`], where: [], order: '', via: '파일 READ', sql: '' })
    }
  }
  return out.sort((a, b) => a.seq - b.seq || a.line - b.line)
}

/** END-IF 로 닫히는 비율. 완비(END-IF >= IF)면 조건 스택을 신뢰할 수 있다. */
function endIfComplete(ast) {
  if (ast._eif !== undefined) return ast._eif
  let i = 0
  let e = 0
  for (const c of ast.code) {
    if (!c.code) continue
    i += (c.code.match(/(?:^|\s)IF(?:\s|$)/g) || []).length
    e += (c.code.match(/END-IF/g) || []).length
  }
  return (ast._eif = { ifs: i, endifs: e, complete: i === 0 || e >= i })
}

/**
 * 그 라인을 감싸는 IF/EVALUATE 조건 스택.
 * **END-IF 가 완비된 파일에서만** 낸다(null = 신뢰 불가) — 마침표 종료 IF 가 섞이면 스택이 어긋나 틀린 답이 된다.
 */
function conditionsAt(ast, para, line) {
  if (!endIfComplete(ast).complete) return null
  const f = ast.fns.get(para)
  if (!f) return []
  const stack = []
  for (const c of ast.code) {
    if (c.line < f.start || c.line >= line || !c.code) continue
    const t = c.code.trim()
    const mi = /^IF\s+(.+?)(?:\s+THEN)?\s*$/i.exec(t)
    if (mi) {
      stack.push({ kind: 'if', text: mi[1].trim(), line: c.line, branch: '' })
      continue
    }
    const me = /^EVALUATE\s+(.+)$/i.exec(t)
    if (me) {
      stack.push({ kind: 'evaluate', text: me[1].trim(), line: c.line, branch: '' })
      continue
    }
    if (/^ELSE\b/i.test(t) && stack.length) stack[stack.length - 1].branch = 'else'
    if (/^WHEN\b/i.test(t) && stack.length) stack[stack.length - 1].branch = t.slice(0, 30)
    for (const _ of t.match(/END-(IF|EVALUATE)/gi) || []) stack.pop()
  }
  return stack
}

function conditionWarning(ast) {
  const e = endIfComplete(ast)
  return e.complete ? null : `이 파일은 END-IF 가 완비되지 않았다 (IF ${e.ifs} / END-IF ${e.endifs}) — 마침표 종료 IF 가 섞여 조건 스택을 내지 않았다`
}

module.exports = {
  name: 'cobol',
  extensions: ['.cbl', '.cob', '.cobol'],
  unit: '문단',
  label: 'cobol',
  writeTargets: '테이블 · 파일',
  parse, closure, effects, reads, fieldWrites, conditionsAt, conditionWarning,
  // 내부 헬퍼 (테스트·확장용)
  endIfComplete, cursors, join, readCode, whereColumns: C.whereColumns,
}
