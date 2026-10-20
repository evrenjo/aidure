#!/usr/bin/env node
/**
 * query-predicates.js — QueryDSL·파생 쿼리·네이티브 SQL 의 기준 테이블·조인·WHERE 컬럼을 DB 컬럼명으로 뽑는다.
 *
 *   node packs/stack-spring/bin/query-predicates.js <Query.java|Repository.java|Service.java> [--method m] [--cols] [--json] [--root <Java 소스>]
 *   node packs/stack-spring/bin/query-predicates.js --find <키워드> [--root <Java 소스>]   # *Query / *Repository 찾기
 *
 * 소스 루트: --root 가 없으면 workspace.json (vars.spring.repo 또는 stack 에 spring 이 든 레포) + vars.spring.basePackage.
 *
 * - QueryDSL: 술어가 헬퍼 메서드에 흩어져 있으므로 **클래스 안 메서드 호출 폐쇄**를 따라간다.
 *   Q타입 별칭은 **메서드 스코프**로 푼다 (같은 이름이 메서드마다 다른 Q타입일 수 있다).
 * - 리포지토리(`extends …Repository<Entity, Id>`): 파생 메서드명을 엔티티 필드 목록으로 **최장 매칭**해 조건을 푼다.
 * - 네이티브 SQL·@Query·텍스트블록 SQL 은 표·WHERE 좌변만 뽑고, 못 읽으면 그 사실을 신고한다.
 * - 엔티티 매핑: @Table/@Column(name) 우선, 없으면 Spring 기본 명명(camelCase → snake_case). 상속(@MappedSuperclass) 컬럼 포함.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { resolve, javaFiles } = require('./lib/spring-src');

const OPS = 'eq|ne|in|notIn|goe|loe|gt|lt|like|likeIgnoreCase|contains|containsIgnoreCase|startsWith|startsWithIgnoreCase|endsWith|eqIgnoreCase|isNull|isNotNull|between|notBetween|isTrue|isFalse|coalesce';

const snake = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/([A-Z])([A-Z][a-z])/g, '$1_$2').toLowerCase();

/** 엔티티 인덱스: 클래스 → 테이블, 클래스.필드 → 컬럼, 클래스 → 상위 클래스 */
function entityIndex(base) {
  const table = new Map();
  const column = new Map();
  const parent = new Map();
  for (const f of javaFiles(base)) {
    const src = fs.readFileSync(f, 'utf8');
    const isEntity = /@Entity\b/.test(src);
    const isMapped = /@(MappedSuperclass|Embeddable)\b/.test(src);
    if (!isEntity && !isMapped && !/@Table\s*\(/.test(src)) continue;
    const mC = /(?:public|abstract)\s+(?:abstract\s+)?class\s+([A-Za-z0-9_]+)(?:\s+extends\s+([A-Za-z0-9_]+))?/.exec(src);
    if (!mC) continue;
    const cls = mC[1];
    if (mC[2]) parent.set(cls, mC[2]);
    const mT = /@Table\s*\(\s*name\s*=\s*"([^"]+)"/.exec(src);
    if (mT) table.set(cls, mT[1]);
    else if (isEntity) table.set(cls, snake(cls));

    const lines = src.split('\n');
    let pending = [];
    for (const line of lines) {
      const t = line.trim();
      if (t.startsWith('@')) {
        pending.push(t);
        continue;
      }
      const fld = /^\s*(?:private|protected|public)\s+(?!static\b)(?:final\s+)?[\w<>,.\[\]?\s]+?\s+([A-Za-z0-9_]+)\s*[;=]/.exec(line);
      if (fld) {
        const ann = pending.join(' ');
        pending = [];
        if (/@(Transient|OneToMany|ManyToMany)\b/.test(ann)) continue;
        const col = /@Column\s*\([^)]*\bname\s*=\s*"([^"]+)"/.exec(ann);
        const join = /@JoinColumn\s*\([^)]*\bname\s*=\s*"([^"]+)"/.exec(ann);
        let name;
        if (col) name = col[1];
        else if (join) name = join[1];
        else if (/@(ManyToOne|OneToOne)\b/.test(ann)) name = snake(fld[1]) + '_id';
        else name = snake(fld[1]);
        column.set(cls + '.' + fld[1], name);
        continue;
      }
      if (t && !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')) {
        // 여러 줄 애너테이션의 중간 줄이면 이어 붙인다
        if (pending.length && !/[;{}]$/.test(t)) pending[pending.length - 1] += ' ' + t;
        else pending = [];
      }
    }
  }
  const lookup = (cls, field) => {
    let c = cls;
    for (let i = 0; i < 6 && c; i++) {
      const hit = column.get(c + '.' + field);
      if (hit) return hit;
      c = parent.get(c);
    }
    return null;
  };
  return { table, column, parent, lookup };
}

/** 파일 단위 별칭 — static import 만. 지역 선언은 메서드 스코프라 여기 넣지 않는다. */
function staticAliases(src) {
  const map = new Map();
  for (const m of src.matchAll(/import\s+static\s+[\w.]*\.Q([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)\s*;/g)) map.set(m[2], m[1]);
  return map;
}

/** 지역 별칭 — 반드시 그 메서드 폐쇄 본문에서만 뽑는다. 파일 단위로 모으면 조용히 틀린 컬럼이 나온다. */
function localAliases(text, base) {
  const map = new Map(base);
  for (const m of text.matchAll(/\bQ([A-Za-z0-9_]+)\s+([A-Za-z0-9_]+)\s*(?:=\s*(?:new\s+Q[A-Za-z0-9_]+\s*\(|Q[A-Za-z0-9_]+\.)|[,)])/g)) map.set(m[2], m[1]);
  return map;
}

/** 메서드 범위 + 같은 클래스 안 호출 그래프 */
function methods(src) {
  const lines = src.split('\n');
  const out = new Map();
  const re = /^\s{2,4}(?:@\w+\s+)*(?:public|private|protected)\s+(?:static\s+|final\s+)*[\w<>,.\[\]?\s]+\s+([A-Za-z0-9_]+)\s*\(/;
  for (let i = 0; i < lines.length; i++) {
    const m = re.exec(lines[i]);
    if (!m || /\b(class|record|enum|interface)\b/.test(lines[i])) continue;
    let depth = 0;
    let started = false;
    let end = i;
    for (let k = i; k < lines.length; k++) {
      for (const ch of lines[k]) {
        if (ch === '{') {
          depth++;
          started = true;
        } else if (ch === '}') depth--;
      }
      if (started && depth <= 0) {
        end = k + 1;
        break;
      }
      if (!started && /;\s*$/.test(lines[k])) {
        end = k + 1;
        break;
      }
    }
    out.set(m[1], { name: m[1], start: i + 1, end, calls: [] });
    i = end - 1;
  }
  for (const f of out.values()) {
    const body = lines.slice(f.start, f.end).join('\n');
    for (const m of body.matchAll(/\b([A-Za-z0-9_]+)\s*\(/g)) if (out.has(m[1]) && m[1] !== f.name) f.calls.push(m[1]);
  }
  return { lines, methods: out };
}

function closure(ms, entry) {
  const seen = new Set();
  (function dfs(n) {
    if (seen.has(n) || !ms.has(n)) return;
    seen.add(n);
    for (const c of ms.get(n).calls) dfs(c);
  })(entry);
  return [...seen];
}

/** QueryDSL / 네이티브 SQL 클래스 분석 — 메서드(+헬퍼 폐쇄)별 기준표·조인·WHERE 컬럼 */
function analyze(file, idx) {
  const src = fs.readFileSync(file, 'utf8');
  const base = staticAliases(src);
  const { lines, methods: ms } = methods(src);
  const results = [];
  for (const m of ms.values()) {
    const body = lines.slice(m.start - 1, m.end).join('\n');
    const hasDsl = /\.(?:from|selectFrom)\s*\(/.test(body);
    const hasSql = javaSqlStrings(body).length > 0;
    if (!hasDsl && !hasSql) continue;
    const scope = closure(ms, m.name);
    const text = scope.map((n) => lines.slice(ms.get(n).start - 1, ms.get(n).end).join('\n')).join('\n');
    const al = localAliases(text, base);
    const resolveCol = (alias, field) => {
      const cls = al.get(alias);
      if (!cls) return null;
      return { table: idx.table.get(cls) || `(${cls})`, column: idx.lookup(cls, field) || `(${field})` };
    };
    const from = [];
    const joins = [];
    for (const x of text.matchAll(/\.(?:from|selectFrom)\s*\(\s*([A-Za-z0-9_]+)\s*[),]/g)) from.push(x[1]);
    for (const x of text.matchAll(/\.(join|leftJoin|innerJoin|rightJoin)\s*\(\s*([A-Za-z0-9_]+)\s*[),]/g)) joins.push(x[2]);
    const cols = [];
    for (const x of text.matchAll(new RegExp(`\\b([A-Za-z0-9_]+)\\.([A-Za-z0-9_]+)\\.(?:${OPS})\\s*\\(`, 'g'))) {
      const r = resolveCol(x[1], x[2]);
      if (!r) continue;
      const key = `${r.table}.${r.column}`;
      if (!cols.includes(key)) cols.push(key);
    }
    const tabs = (a) => [...new Set(a.map((x) => (al.has(x) ? idx.table.get(al.get(x)) || `(${al.get(x)})` : `(${x})`)))];
    const aliasRe = al.size ? new RegExp(`\\b(?:${[...al.keys()].join('|')})\\.`) : null;
    const contributing = scope.filter((n) => n !== m.name && aliasRe && aliasRe.test(lines.slice(ms.get(n).start - 1, ms.get(n).end).join('\n')));
    results.push({
      method: m.name,
      line: m.start,
      helpers: contributing,
      from: tabs(from),
      joins: tabs(joins),
      columns: cols,
      native: /createNativeQuery|nativeQuery\s*=\s*true|Expressions\.(?:boolean|string|number)Template/.test(text),
      raw: rawSqlFacts(javaSqlStrings(text)),
    });
  }
  return { file, aliasCount: base.size, results };
}

/** Spring Data 파생 쿼리 연산자 — 긴 것부터 매칭한다. */
const DERIVED_OPS = [
  'IsGreaterThanEqual', 'GreaterThanEqual', 'IsLessThanEqual', 'LessThanEqual',
  'IsGreaterThan', 'GreaterThan', 'IsLessThan', 'LessThan',
  'IsNotNull', 'NotNull', 'IsNull', 'Null', 'IsNotIn', 'NotIn', 'IsIn',
  'IsNotLike', 'NotLike', 'IsLike', 'IsStartingWith', 'StartingWith',
  'IsEndingWith', 'EndingWith', 'IsContaining', 'Containing', 'Contains',
  'IsNotBetween', 'NotBetween', 'IsBetween', 'Between',
  'IsAfter', 'After', 'IsBefore', 'Before',
  'IsTrue', 'True', 'IsFalse', 'False',
  'AllIgnoreCase', 'IgnoreCase', 'IsNot', 'Not', 'Equals', 'Like', 'In', 'Is',
];

function repoEntity(src) {
  const m = /extends\s+[A-Za-z0-9_]*Repository\s*<\s*([A-Za-z0-9_]+)/.exec(src);
  return m ? m[1] : null;
}

/** `findAllByOrderIdAndIsDeleted` 를 조건으로 푼다 — 필드 이름에 And 가 들어갈 수 있어 엔티티 필드로 최장 매칭한다. */
function parseDerived(name, fields) {
  const m = /^(find|read|get|query|search|stream|count|exists|delete|remove)(.*?)By([A-Z].*)$/.exec(name);
  if (!m) return null;
  let rest = m[3];
  let order = '';
  const mo = /OrderBy([A-Z].*)$/.exec(rest);
  if (mo) {
    order = mo[1];
    rest = rest.slice(0, mo.index);
  }
  const caps = new Map();
  for (const f of fields) caps.set(f.charAt(0).toUpperCase() + f.slice(1), f);
  const names = [...caps.keys()].sort((a, b) => b.length - a.length);
  const cols = [];
  const unknown = [];
  let i = 0;
  let guard = 0;
  while (i < rest.length && guard++ < 60) {
    const hit = names.find((n) => rest.startsWith(n, i));
    if (!hit) {
      const nx = rest.slice(i).search(/And|Or/);
      unknown.push(rest.slice(i, nx === -1 ? undefined : i + nx));
      if (nx === -1) break;
      i += nx;
    } else {
      cols.push(caps.get(hit));
      i += hit.length;
      const op = DERIVED_OPS.find((o) => rest.startsWith(o, i));
      if (op) i += op.length;
    }
    if (rest.startsWith('And', i)) i += 3;
    else if (rest.startsWith('Or', i)) i += 2;
  }
  return { verb: m[1], subject: m[2], columns: cols, unknown: unknown.filter(Boolean), order };
}

/** 리포지토리 분석 — 파생 메서드 + @Query/네이티브 신고 */
function analyzeRepo(file, idx) {
  const src = fs.readFileSync(file, 'utf8');
  const ent = repoEntity(src);
  if (!ent) return null;
  const table = idx.table.get(ent) || `(${ent})`;
  const fields = [];
  for (const k of idx.column.keys()) {
    let c = ent;
    for (let i = 0; i < 6 && c; i++) {
      if (k.startsWith(c + '.')) {
        fields.push(k.slice(c.length + 1));
        break;
      }
      c = idx.parent.get(c);
    }
  }
  const results = [];
  const lines = src.split('\n');
  for (let n = 0; n < lines.length; n++) {
    const md = /^\s{2,4}(?:@\w+[^\n]*)?\s*(?:[\w<>,.\[\]?\s]+\s+)?([a-z][A-Za-z0-9]+)\s*\(/.exec(lines[n]);
    if (!md) continue;
    const d = parseDerived(md[1], fields);
    if (!d) continue;
    const annotated = /@Query/.test(lines.slice(Math.max(0, n - 4), n).join('\n'));
    results.push({
      method: md[1],
      line: n + 1,
      from: [table],
      joins: [],
      helpers: [],
      columns: d.columns.map((f) => `${table}.${idx.lookup(ent, f) || '(' + f + ')'}`),
      unknown: d.unknown,
      order: d.order,
      native: annotated,
      raw: annotated ? rawSqlFacts(javaSqlStrings(lines.slice(Math.max(0, n - 12), n + 1).join('\n'))) : { tables: [], cols: [] },
    });
  }
  return { file, entity: ent, table, aliasCount: fields.length, results };
}

/** SQL 문자열 수집 — 텍스트블록 + createNativeQuery/createQuery/@Query 인자 + `"…" + var + "…"` 연결. */
function javaSqlStrings(text) {
  const out = [];
  for (const m of text.matchAll(/"""([\s\S]*?)"""/g)) out.push(m[1]);
  for (const m of text.matchAll(/\b(?:createNativeQuery|createQuery)\s*\(|@Query\s*\(/g)) {
    let i = m.index + m[0].length;
    let depth = 1;
    let arg = '';
    while (i < text.length && depth > 0) {
      const ch = text[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      if (depth > 0) arg += ch;
      i++;
    }
    const lits = [...arg.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((x) => x[1]);
    const tb = [...arg.matchAll(/"""([\s\S]*?)"""/g)].map((x) => x[1]);
    const joined = (tb.length ? tb : lits).join(' ');
    if (joined.trim()) out.push(joined);
  }
  for (const m of text.matchAll(/(?:"(?:[^"\\]|\\.)*"\s*\+?\s*){2,}/g)) {
    out.push([...m[0].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((x) => x[1]).join(''));
  }
  return [...new Set(out.map((x) => x.replace(/\s+/g, ' ').trim()))].filter((x) => /\b(select|insert|update|delete)\b/i.test(x));
}

/** WHERE 절 좌변 컬럼 (SQL 주석 제거 후) */
function whereColumns(raw) {
  const sql = String(raw).replace(/--[^\n]*/g, ' ').replace(/\\"/g, '"').replace(/"/g, '');
  const m = /\bWHERE\b([\s\S]*?)(?:\bORDER\s+BY\b|\bGROUP\s+BY\b|\bFOR\s+UPDATE\b|$)/i.exec(sql);
  if (!m) return [];
  const cols = [];
  for (const g of m[1].matchAll(/(?:^|[\s(]|\bAND\b|\bOR\b)\s*(?:[A-Z0-9_]+\.)?([A-Z_][A-Z0-9_]{2,})\s*(?:=|<>|!=|<=|>=|<|>|\bLIKE\b|\bIN\b|\bIS\b|\bBETWEEN\b)/gi)) {
    const c = g[1].toUpperCase();
    if (!['AND', 'OR', 'NOT', 'WHERE', 'NULL', 'SELECT', 'FROM'].includes(c) && !cols.includes(c)) cols.push(c);
  }
  return cols;
}

function rawSqlFacts(sqls) {
  const tables = [];
  const cols = [];
  for (const q of sqls) {
    const plain = q.replace(/\\"/g, '"');
    for (const t of plain.matchAll(/\b(?:from|join|into|update)\s+"?([a-z_][a-z0-9_]*)"?/gi)) {
      const n = t[1].toLowerCase();
      if (!['select', 'where', 'set', 'values', 'dual'].includes(n) && !tables.includes(n)) tables.push(n);
    }
    for (const c of whereColumns(plain)) {
      const n = c.toLowerCase();
      if (!cols.includes(n)) cols.push(n);
    }
  }
  return { tables, cols };
}

module.exports = { entityIndex, analyze, analyzeRepo, parseDerived, javaSqlStrings, whereColumns, snake };

// ── CLI ──
function main() {
  const argv = process.argv.slice(2);
  const flag = (n) => {
    const i = argv.indexOf('--' + n);
    return i === -1 ? null : argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true;
  };
  const USAGE = '사용법: node packs/stack-spring/bin/query-predicates.js <Query.java|Repository.java> [--method m] [--cols] [--json] [--root <Java 소스>]  |  --find <키워드>';
  if (flag('help') || argv.includes('-h')) {
    console.log(USAGE);
    return 0;
  }
  const src = resolve(process.argv);
  if (src.error) {
    console.error(`소스 루트를 정하지 못했습니다. ${src.error}`);
    return 2;
  }

  if (flag('find')) {
    const kw = String(flag('find')).toLowerCase();
    const hits = javaFiles(src.base).filter((f) => /(Query|Repository)\.java$/.test(f) && path.basename(f).toLowerCase().includes(kw));
    hits.forEach((h) => console.log('  ' + path.relative(process.cwd(), h)));
    if (!hits.length) console.log('  없음');
    return 0;
  }

  const target = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && ['--root', '--method'].includes(argv[i - 1])));
  if (!target) {
    console.error(USAGE);
    return 2;
  }
  if (!fs.existsSync(target)) {
    console.error(`파일이 없습니다: ${target}`);
    return 2;
  }
  const idx = entityIndex(src.base);
  const head = fs.readFileSync(target, 'utf8');
  const isRepo = /extends\s+[A-Za-z0-9_]*Repository\s*</.test(head);
  const out = isRepo ? analyzeRepo(target, idx) : analyze(target, idx);
  if (!out) {
    console.error('리포지토리인데 엔티티 타입을 찾지 못했습니다 (extends …Repository<Entity, Id>)');
    return 2;
  }
  const only = flag('method');
  let rs = out.results;
  if (only && only !== true) rs = rs.filter((r) => r.method === only);

  if (flag('json')) {
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
    return 0;
  }
  if (flag('cols')) {
    for (const r of rs) console.log(r.columns.sort().join('\n'));
    return 0;
  }

  console.log(
    `\n■ ${path.basename(target)}  (` +
      (isRepo ? `엔티티 ${out.entity} → ${out.table} · 필드 ${out.aliasCount}개` : `static 별칭 ${out.aliasCount}개`) +
      ` · 조회 메서드 ${out.results.length}개)`,
  );
  if (!out.results.length) console.log('\n  ⚠ 조회 메서드가 없다. 파서가 못 읽은 형태일 수 있다\n');
  for (const r of rs) {
    console.log(`\n── ${r.method}  (:${r.line})` + (r.helpers.length ? `  ← ${r.helpers.join(', ')}` : ''));
    console.log(`   기준표 : ${r.from.join(', ') || '(없음)'}`);
    if (r.joins.length) console.log(`   조인   : ${r.joins.join(', ')}`);
    console.log(`   WHERE  : ${r.columns.length ? r.columns.join(', ') : '(없음)'}`);
    if (r.order) console.log(`   ORDER  : ${r.order}`);
    if (r.unknown && r.unknown.length) console.log(`   ⚠ 못 푼 조각: ${r.unknown.join(', ')}: 중첩 속성이거나 엔티티에 없는 필드다`);
    if (r.raw && (r.raw.tables.length || r.raw.cols.length)) {
      console.log(`   원시SQL : 표 ${r.raw.tables.join(', ') || '(없음)'}`);
      if (r.raw.cols.length) console.log(`            WHERE ${r.raw.cols.join(', ')}`);
    }
    if (r.native && !(r.raw && r.raw.tables.length)) {
      console.log(r.raw && r.raw.cols.length
        ? '   ⚠ 원시 SQL 에서 표를 못 찾았다 (INSERT…SELECT·서브쿼리일 수 있다). 직접 확인'
        : '   ⚠ @Query·네이티브·Expressions 템플릿이 붙어 있는데 SQL 을 못 읽었다. 직접 확인');
    }
  }
  console.log();
  return 0;
}

if (require.main === module) process.exitCode = main();
