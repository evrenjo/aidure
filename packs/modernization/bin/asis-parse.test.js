#!/usr/bin/env node
/**
 * asis-parse.test.js — 레거시 파서·도구 회귀 테스트 (EGL + COBOL + 뷰/매핑 체인 + diff). 실 소스 없이 fixtures/ 만 쓴다.
 *   node packs/modernization/bin/asis-parse.test.js
 * 각 검사는 실제로 겪은 오판 유형 하나씩을 막는다 (주석 참조).
 */
'use strict'
const path = require('path')
const cp = require('child_process')
const pick = require(path.join(__dirname, 'asis-dialect.js'))
const C = require(path.join(__dirname, 'dialects', '_common.js'))

const FX = path.join(__dirname, 'fixtures')
const E = pick('x.egl')
const CB = pick('x.cbl')
const node = (script, args, opt = {}) => cp.execFileSync(process.execPath, [path.join(__dirname, script), ...args], { encoding: 'utf8', cwd: FX, maxBuffer: 1e8, ...opt })
const MAP_OPTS = ['--view-dir', path.join(FX, 'views'), '--variant', 'main', '--mapping', path.join(FX, 'mapping'), '--canonical', 'main.yaml', '--schema-dir', path.join(FX, 'schema')]

let fail = 0
const check = (name, ok, detail) => {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${ok || detail === undefined ? '' : '\n       ' + detail}`)
  if (!ok) fail++
}
const at = (list, loc) => list.find((x) => `${x.fn}:${x.line}` === loc)

// ⓪ 방언 레지스트리
check('방언 레지스트리 — .egl/.cbl 자동 선택', E.name === 'egl' && CB.name === 'cobol')
{
  let threw = false
  try {
    pick('x.unknown')
  } catch (e) {
    threw = /지원하지 않는 확장자/.test(e.message)
  }
  check('모르는 확장자는 예외', threw)
}

// ① EGL 효과 폐쇄
const F = path.join(FX, 'egl', 'STCOPY.egl')
const ast = E.parse(F)
const whole = E.effects(ast, C.wholeFile(ast))
{
  const clo = E.closure(ast, ['P14', 'P15'])
  const eff = E.effects(ast, clo)
  const tables = new Set(eff.flatMap((e) => e.tables))
  check('복사 대상 표 검출 (HDRV·LNKV·DTLV)', ['HDRV', 'LNKV', 'DTLV'].every((t) => tables.has(t)), [...tables].join(','))

  // 드라이버가 둘이면 둘 다 줘야 한다 — 한쪽만 주면 그쪽 전용 쓰기를 놓친다
  const only14 = new Set(E.effects(ast, E.closure(ast, ['P14'])).map((e) => `${e.fn}:${e.line}`))
  check('다중 진입점 — PLC:32(LNKV) 는 P15 경로에만 있다', !only14.has('PLC:32') && !!at(eff, 'PLC:32'))

  // add R with #sql{insert} 는 한 문장 — 두 번 세지 않는다
  check('add + 인라인 SQL 중복 제거 (PCP:22 한 건, :24 없음)', !!at(eff, 'PCP:22') && !at(eff, 'PCP:24') && at(eff, 'PCP:22').tables.join() === 'LNKV')

  // 진짜 진입점은 드라이버 위의 PAA — 두 드라이버만 주면 복사 뒤 UPDATE 를 놓친다
  const inNarrow = new Set(eff.map((e) => `${e.fn}:${e.line}`))
  const missed = whole.filter((e) => !inNarrow.has(`${e.fn}:${e.line}`)).map((e) => `${e.fn}:${e.line}`)
  check('P14,P15 만 주면 PW1:66 UPDATE 를 놓친다 (폐쇄 밖 신고 대상)', missed.includes('PW1:66'), missed.join(' '))
  const inAA = new Set(E.effects(ast, E.closure(ast, ['PAA'])).map((e) => `${e.fn}:${e.line}`))
  const outAA = whole.filter((e) => !inAA.has(`${e.fn}:${e.line}`)).map((e) => e.fn)
  check('PAA 폐쇄 밖 쓰기는 PDL(별도 진입점)뿐', outAA.every((f) => f === 'PDL') && outAA.length === 3, outAA.join(' '))
  check('라인번호로 진입점 지정 (7 → PAA)', E.closure(ast, ['7']).entry === 'PAA')
}

// ② 줄바꿈된 SQL 동사 · EGL delete 문 · for update of
{
  const e = E.effects(ast, E.closure(ast, ['PDL']))
  check('`DELETE\\n FROM CMTV` → PDL:71', !!at(e, 'PDL:71') && at(e, 'PDL:71').tables.join() === 'CMTV')
  check('`delete from\\n LINEV` → PDL:76 (레코드 FROM 오탐 없음)', !!at(e, 'PDL:76') && at(e, 'PDL:76').tables.join() === 'LINEV' && !e.some((x) => x.record === 'FROM'))
  check('레코드 경유 `delete RHDR;` → HDRV', !!at(e, 'PDL:79') && at(e, 'PDL:79').tables.join() === 'HDRV')
  check('테이블 없는 쓰기 0건', whole.every((x) => x.tables.length), whole.filter((x) => !x.tables.length).map((x) => `${x.fn}:${x.line}`).join(' '))
  check('`select … for update of` 는 쓰기로 안 센다 (P7C:58)', !whole.some((x) => x.line === 58 || x.line === 59))
}

// ③ 한 필드의 쓰기 — 첫 대입이 최종값이 아니다
{
  const sites = E.fieldWrites(ast, E.closure(ast, ['PAA']), 'UNITS', { keep: (r) => ['RDTL'].includes(r) })
  const locs = sites.map((s) => `${s.fn}:${s.line}:${s.how}`)
  check('UNITS — set empty(초기화) → = 0 → 재대입 → move 순', locs.join(' ') === 'P72:40:초기화 P72:41:대입 P7C:49:대입 P7C:51:통째복사', locs.join(' '))
  check('UNITS = 0 뒤에 재대입이 온다', sites.findIndex((s) => s.expr === '0') < sites.findIndex((s) => /W\.QTY/.test(s.expr)))
  const cond = E.conditionsAt(ast, 'P72', 41)
  check('조건 스택 — UNITS=0 은 KFSC 공백 + ACTIVE 아래', cond.length === 2 && /KFSC/.test(cond[0].text) && /ACTIVE/.test(cond[1].text), cond.map((c) => c.text).join(' / '))
}

// ④ 레코드 → 테이블·컬럼 매핑 (세 형태 + 닫힘)
{
  const rec = (n) => ast.records.get(n) || { tables: [], columns: new Map() }
  check('레코드 매핑 RDTL → DTLV, UNITS → NUM_UNITS', rec('RDTL').tables.join() === 'DTLV' && rec('RDTL').columns.get('UNITS') === 'NUM_UNITS')
  check('헤더 줄 tableNames + 다음 줄 defaultSelectCondition (RINV)', rec('RINV').tables.join() === 'INVV' && /CD_STATUS/.test(rec('RINV').cond || ''))
  check('한 줄 레코드 `[["CLONE_LIST","T1"]]}`', rec('RCDL').tables.join() === 'CLONE_LIST')
  check('여러 줄에 걸친 조인 레코드 RJN = 3개 표', rec('RJN').tables.join() === 'DTLV,HDRV,DTLV', rec('RJN').tables.join())
  check('별칭 없는 tableNames `[["ITEM_MASTER"]]`', rec('RCF').tables.join() === 'ITEM_MASTER')
  check('`end // end X` 로 레코드가 닫혀 다음 줄이 섞이지 않는다', rec('RSO').columns.size === 2, rec('RSO').columns.size)
  const empty = [...ast.records.values()].filter((r) => !r.tables.length).map((r) => r.name)
  check('테이블 0개인 레코드 없음', empty.length === 0, empty.join(' '))
}

// ⑤ 읽기 — defaultSelectCondition 경유 조건이 드러난다 (뷰 조건을 모른 채 가정하지 않게)
{
  const rs = E.reads(ast, E.closure(ast, ['PAA']))
  const inv = rs.filter((r) => r.tables.includes('INVV'))
  const cols = [...new Set(inv.flatMap((r) => r.where))]
  check('INVV WHERE = ID_PROF·ID_FSC·TAG_DELETE·CD_STATUS', ['ID_PROF', 'ID_FSC', 'TAG_DELETE', 'CD_STATUS'].every((c) => cols.includes(c)) && cols.length === 4, cols.join(','))
  const inl = rs.find((r) => r.line === 52)
  check('인라인 SELECT — FROM+JOIN 표 둘, ORDER BY', inl && inl.tables.join() === 'DTLV,HDRV' && /ID_FSC/.test(inl.order), inl && inl.tables.join())
  check('정의 없는 레코드 참조는 조용히 빠뜨리지 않고 신고 (REXT)', (rs.unresolved || []).some((u) => /REXT/.test(u)))
}

// ⑥ 소문자 키워드 · 0개 파싱
{
  const a = E.parse(path.join(FX, 'egl', 'LOWER.egl'))
  check('소문자 function/record 파싱', a.fns.size === 2 && (a.records.get('RLOW') || { tables: [] }).tables.join() === 'LOWV')
  let threw = false
  try {
    E.closure({ fns: new Map(), records: new Map(), lines: [] }, ['X'])
  } catch (e) {
    threw = /0개/.test(e.message)
  }
  check('함수 0개면 빈 결과 대신 예외', threw)
}

// ⑦ COBOL
{
  const P1 = path.join(FX, 'cobol', 'prog01.cbl')
  const c = CB.parse(P1)
  check('cobol 문단 파싱 (7개, 인라인 PERFORM VARYING 은 문단 아님)', c.fns.size === 7, [...c.fns.keys()].join(' '))
  const cc = CB.closure(c, ['100-mainline'])
  check('cobol PERFORM A THRU B 가 사이 문단까지 편다 (200-MID)', cc.internal.has('200-MID'))
  check('cobol 외부는 CALL 만 (예약어 오탐 없음)', [...cc.external].join() === 'EXTPGM1', [...cc.external].join(' '))
  const ce = CB.effects(c, cc)
  const sql = new Set(ce.filter((e) => !e.kind.startsWith('FILE')).flatMap((e) => e.tables))
  check('cobol EXEC SQL 쓰기 표 (DTLV·LINEV·CMTV)', ['DTLV', 'LINEV', 'CMTV'].every((t) => sql.has(t)) && sql.size === 3, [...sql].join(','))
  check('cobol 주석 줄의 SQL 은 세지 않는다 (HDRV 는 900-UNUSED 에만)', !sql.has('HDRV'))
  check('cobol 파일 WRITE + FD/ASSIGN 매핑', ce.some((e) => e.kind === 'FILE WRITE' && e.tables[0] === 'RPT-FILE (RPTOUT)'))
  const rd = CB.reads(c, cc)
  check('cobol 커서 선언(절차부 밖) → OPEN/FETCH 읽기', rd.filter((r) => /커서 CUR-DTL/.test(r.via)).length === 2 && rd[0].where.join() === 'CMP_ID,TAG_DELETE')
  check('cobol 단건 SELECT · 파일 READ', rd.some((r) => r.via === '단건 SELECT' && r.tables.join() === 'HDRV') && rd.some((r) => r.via === '파일 READ'))
  const fw = CB.fieldWrites(c, cc, 'DTL-UNITS')
  check('cobol 필드 쓰기 MOVE → COMPUTE 순', fw.map((s) => s.how).join() === 'MOVE,COMPUTE', fw.map((s) => s.how).join())
  check('cobol END-IF 미완비 파일은 조건 스택을 내지 않는다 (null)', CB.conditionsAt(c, '300-PROCESS', 44) === null && !!CB.conditionWarning(c))

  const P2 = path.join(FX, 'cobol', 'prog02.cbl')
  const c2 = CB.parse(P2)
  check('cobol END-IF 완비 판정 (prog02)', CB.endIfComplete(c2).complete)
  const st = CB.conditionsAt(c2, '0000-MAIN', 14)
  check('cobol 조건 스택 — IF→else · EVALUATE→WHEN', st.length === 2 && st[0].branch === 'else' && /WHEN 'A'/.test(st[1].branch), JSON.stringify(st))
}

// ⑧ CLI — 좁은 진입점 경고 · 진입점 추천 · 파일 해석
{
  const narrow = JSON.parse(node('asis-reads.js', [F, '--entry', 'P72', '--json']))
  check('좁은 진입점이면 폐쇄 밖 읽기를 신고한다', narrow.outsideClosure.length === 2, narrow.outsideClosure.length)
  let sug = ''
  try {
    node('asis-reads.js', [F], { stdio: 'pipe' })
  } catch (e) {
    sug = e.stderr || ''
  }
  check('진입점 없이 부르면 최소 조합을 추천한다', /--entry PAA\b/.test(sug), sug.trim().split('\n').pop())
  const eff = node('asis-effects.js', [F, '--entry', 'P14,P15', '--tobe', 'HDRV,LNKV,EXTRA_T'])
  check('effects --tobe 대조 (AS-IS 에만 DTLV / TO-BE 에만 EXTRA_T)', /AS-IS 에 있고 TO-BE 에 없음: DTLV/.test(eff) && /TO-BE 에 있고 AS-IS 에 없음: EXTRA_T/.test(eff))
  check('effects 폐쇄 밖 경고 문구', /⚠ 폐쇄 밖 쓰기/.test(eff))
  const fw = node('asis-field-writes.js', [F, '--entry', 'PAA', '--field', 'UNITS', '--table', 'DTLV'])
  check('field-writes --table → RDTL.UNITS → NUM_UNITS', /RDTL\.UNITS → NUM_UNITS/.test(fw) && /경로 끝의 쓰기: P7C:51/.test(fw))
}

// ⑨ AS-IS ↔ TO-BE 매핑 체인
{
  const j = (x, extra = []) => JSON.parse(node('asis-tobe-map.js', [x, ...MAP_OPTS, ...extra, '--json']))
  const a = j('INVV.ID_PROF')
  check('위치 대응 뷰 INVV.ID_PROF → item_master.profile_code', a.chain && a.chain[0].tobe === 'item_master.profile_code', JSON.stringify(a.chain))
  const d = j('INVV.DSC_CALC')
  check('가공식 컬럼은 direct=false', d.direct === false)
  const b = j('DTLV.NUM_UNITS')
  check('pass-through 뷰 DTLV.NUM_UNITS → detail_line.units_number', b.chain && b.chain[0].tobe === 'detail_line.units_number', JSON.stringify(b.chain))
  const alt = JSON.parse(node('asis-tobe-map.js', ['DTLV.NUM_UNITS', ...MAP_OPTS.map((x) => (x === 'main' ? 'alt' : x)), '--json']))
  check('--variant 로 다른 뷰 정의 폴더 (DTL_ALT)', alt.chain && alt.chain[0].base === 'DTL_ALT.NUM_UNITS', JSON.stringify(alt.chain))
  const head = (x) => node('asis-tobe-map.js', [x, ...MAP_OPTS]).split('\n').find((l) => l.startsWith('■')) || ''
  check('여러 스텝이 읽는 표는 1:1 정본 스텝 (LNK → store_link)', / → store_link /.test(head('LNK')) && /sim_key/.test(head('LNK')), head('LNK'))
  const c = j('LNK.CD_TARGET')
  check('컬럼은 고른 스텝 대상표 것만 (LNK.CD_TARGET ≠ sim_target)', c.chain[0].tobe === 'store_link.target_code', JSON.stringify(c.chain))
  check('실 DDL 에 없는 대상표는 다른 후보가 있으면 뺀다 (OLDT → new_table)', / → new_table /.test(head('OLDT')), head('OLDT'))
  const w = node('asis-tobe-map.js', ['INVV', '--where', ...MAP_OPTS])
  check('--where 조인 1 / 필터 1 분리', /조인 조건 1개 \/ 필터 조건 1개/.test(w) && /필터: T1\.DELETED_IN = ''/.test(w), w.split('\n').slice(1, 5).join(' | '))
  const jn = node('asis-tobe-map.js', ['JNV', ...MAP_OPTS])
  check('.sql 뷰 · JOIN … ON 의 키워드를 테이블로 잡지 않는다', /베이스: ALPHA, BETA/.test(jn) && !/베이스: .*\b(ON|AND|OR|JOIN)\b/.test(jn), jn.split('\n')[1])
}

// ⑩ diff — 이름을 맞춘 뒤 차집합 (TO-BE 추출기는 stub)
{
  const out = JSON.parse(node('asis-tobe-diff.js', ['--asis', F, '--entry', 'P72', '--tobe', 'Any.java', '--tobe-tool', path.join(FX, 'stub-tobe-query.js'), ...MAP_OPTS, '--json']))
  const t = out.tables.item_master || {}
  check('diff — 공통 fsc_code·deleted_flag', ['fsc_code', 'deleted_flag'].every((x) => (t.both || []).includes(x)), JSON.stringify(t))
  check('diff — AS-IS 만 profile_code / TO-BE 만 country_code', (t.asisOnly || []).includes('profile_code') && (t.tobeOnly || []).includes('country_code'), JSON.stringify(t))
  check('diff — 매핑 못 한 조건 신고 (CD_STATUS 는 PROFILE 쪽, 스텝 없음)', out.unmapped.includes('INVV.CD_STATUS'), out.unmapped.join(','))
}

console.log(fail ? `\n■ 실패 ${fail}건\n` : '\n■ 전부 통과\n')
process.exit(fail ? 1 : 0)
