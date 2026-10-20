// 방언 공용 헬퍼 — WHERE 좌변 컬럼 추출 · 진입점 폐쇄(호출 그래프 DFS). 단독 실행 대상 아님.
'use strict'

/** WHERE 절에서 좌변 컬럼만 뽑는다 (호스트 변수 `:NAME` 제외). */
function whereColumns(raw) {
  // SQL 주석(`-- …`)을 먼저 턴다 — 안 그러면 주석 단어가 컬럼으로 잡힌다
  const sql = String(raw).replace(/--[^\n]*/g, ' ')
  const m = /\bWHERE\b([\s\S]*?)(?:\bORDER\s+BY\b|\bGROUP\s+BY\b|\bFOR\s+UPDATE\b|$)/i.exec(sql)
  if (!m) return []
  const cols = []
  for (const g of m[1].matchAll(/(?:^|[\s(]|\bAND\b|\bOR\b)\s*(?:[A-Z0-9_]+\.)?([A-Z_][A-Z0-9_]{2,})\s*(?:=|<>|!=|<=|>=|<|>|\bLIKE\b|\bIN\b|\bIS\b|\bBETWEEN\b)/gi)) {
    const c = g[1].toUpperCase()
    if (!['AND', 'OR', 'NOT', 'WHERE', 'NULL', 'SELECT', 'FROM'].includes(c) && !cols.includes(c)) cols.push(c)
  }
  return cols
}

/**
 * 진입점(이름·라인번호, 또는 그 배열)에서 도달 가능한 단위(함수·문단)를 전이적으로 펼친다.
 * opt.unit = 단위 이름(오류 문구) · opt.normalize = 이름 정규화(cobol 은 대문자) · opt.hint = 0개일 때 점검 안내.
 */
function closure(ast, entries, opt = {}) {
  const unit = opt.unit || '함수'
  const norm = opt.normalize || ((x) => x)
  if (!ast.fns.size) {
    throw new Error(
      `파싱된 ${unit}가 0개다 — 파서가 이 파일을 못 읽은 것일 수 있다.\n` +
      `  확인: ${opt.hint || '방언·인코딩'}. 0건을 "없다" 로 읽지 말 것.`
    )
  }
  const list = Array.isArray(entries) ? entries : [entries]
  const resolved = list.map((entry) => {
    if (/^\d+$/.test(String(entry))) {
      const n = Number(entry)
      let hit = null
      for (const f of ast.fns.values()) if (n >= f.start && n <= f.end) hit = f.name
      if (!hit) throw new Error(`라인 ${n} 을 포함하는 ${unit}가 없습니다`)
      return hit
    }
    const name = norm(String(entry))
    if (!ast.fns.has(name)) throw new Error(`${unit} ${name} 이 이 파일에 없습니다`)
    return name
  })

  const seen = new Map() // name -> 진입 순번 (호출 경로 순 근사)
  const external = new Set()
  const order = []
  let seq = 0
  function dfs(name) {
    if (seen.has(name)) return
    if (!ast.fns.has(name)) {
      external.add(name)
      return
    }
    seen.set(name, ++seq)
    order.push(name)
    for (const c of [...ast.fns.get(name).calls].sort((a, b) => a.line - b.line)) dfs(c.name)
  }
  for (const e of resolved) dfs(e)
  return { entry: resolved.join(' + '), entries: resolved, internal: seen, external, order }
}

/** 파일 전체를 하나의 폐쇄로 본 것 — "폐쇄 밖 효과" 를 가려내는 기준. */
function wholeFile(ast) {
  const all = [...ast.fns.keys()]
  return { order: all, internal: new Map(all.map((n, i) => [n, i + 1])), external: new Set() }
}

/** 아무도 부르지 않는 단위 = 진입점 후보. 여러 개면 전부 줘야 폐쇄가 닫힌다. */
function roots(ast) {
  const called = new Set()
  for (const f of ast.fns.values()) for (const c of f.calls) called.add(c.name)
  return [...ast.fns.keys()].filter((n) => !called.has(n))
}

module.exports = { whereColumns, closure, wholeFile, roots }
