#!/usr/bin/env node
/**
 * `Projections.constructor(...)` 의 인자 수와 `Projections.fields/bean(...)` 의 필드명이 대상 타입과 맞는지 검사한다. 불일치 있으면 exit 1.
 *
 *   node packs/stack-spring/bin/check-querydsl-projection-arity.js [--list] [--root <Java 소스>]
 *
 * 왜: QueryDSL 의 `Projections.constructor` 는 **런타임 리플렉션**으로 생성자를 찾는다. 인자 수가 어긋나도
 * 컴파일·기동은 통과하고 그 쿼리를 만드는 순간에야 `ExpressionException: No constructor found` 로 터진다.
 * DTO 에서 필드 하나를 빼고 projection 한 곳을 빠뜨려도 빌드는 통과한다. `fields`/`bean` 은 개수가 아니라
 * **이름**으로 맞추므로 없는 이름을 넘기면 같은 방식으로 터진다 — 그래서 함께 검사한다.
 * 소스 루트: --root 가 없으면 workspace.json (vars.spring.repo 또는 stack 에 spring 이 든 레포).
 */
const fs = require('fs');
const path = require('path');

const { resolve } = require('./lib/spring-src');

const WORKSPACE = process.cwd();

/** Lombok 이 전 필드 생성자를 만들어 주는 애너테이션. */
const ALL_ARGS = /@(AllArgsConstructor|Value)\b/;

function javaFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) javaFiles(p, out);
    else if (e.name.endsWith('.java')) out.push(p);
  }
  return out;
}

/** 주석과 문자열 리터럴을 같은 길이의 공백으로 바꾼다 — 괄호 세기가 흔들리지 않게. */
function blank(src) {
  const out = src.split('');
  let i = 0;
  const wipe = (from, to) => {
    for (let k = from; k < to && k < out.length; k++) if (out[k] !== '\n') out[k] = ' ';
  };
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === '//') {
      const end = src.indexOf('\n', i);
      wipe(i, end === -1 ? src.length : end);
      i = end === -1 ? src.length : end;
    } else if (two === '/*') {
      const end = src.indexOf('*/', i + 2);
      wipe(i, end === -1 ? src.length : end + 2);
      i = end === -1 ? src.length : end + 2;
    } else if (src[i] === '"' || src[i] === "'") {
      const q = src[i];
      let j = i + 1;
      while (j < src.length && src[j] !== q) j += src[j] === '\\' ? 2 : 1;
      wipe(i, j + 1);
      i = j + 1;
    } else i++;
  }
  return out.join('');
}

/** open 위치(여는 괄호)부터 짝이 맞는 닫는 괄호 인덱스. */
function matchParen(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')' && --depth === 0) return i;
  }
  return -1;
}

/** 괄호·꺾쇠·중괄호 깊이 0 의 쉼표로 인자를 센다. 빈 목록은 0. */
function countArgs(inner) {
  if (inner.trim() === '') return 0;
  let depth = 0;
  let n = 1;
  for (const ch of inner) {
    if ('([{<'.includes(ch)) depth++;
    else if (')]}>'.includes(ch)) depth--;
    else if (ch === ',' && depth === 0) n++;
  }
  return n;
}

/** 타입 선언(record/class)의 본문과 앞선 애너테이션을 찾는다. 중첩 타입도 잡는다. */
function findDecl(sources, typeName, preferFile) {
  const re = new RegExp('\\b(record|class)\\s+' + typeName + '\\b', 'g');
  const ordered = preferFile
    ? [...sources.filter((s) => s.file === preferFile), ...sources.filter((s) => s.file !== preferFile)]
    : sources;
  for (const { file, src } of ordered) {
    for (const m of src.matchAll(re)) {
      const head = src.slice(Math.max(0, m.index - 400), m.index);
      const kind = m[1];
      const brace = src.indexOf('{', m.index);
      if (kind === 'record') {
        const open = src.indexOf('(', m.index);
        if (open === -1) continue;
        const close = matchParen(src, open);
        if (close === -1) continue;
        const decl = { file, kind, head, name: typeName, params: countArgs(src.slice(open + 1, close)) };
        if (brace !== -1 && brace > close) {
          let d = 0;
          let e = -1;
          for (let i = brace; i < src.length; i++) {
            if (src[i] === '{') d++;
            else if (src[i] === '}' && --d === 0) {
              e = i;
              break;
            }
          }
          if (e !== -1) decl.body = src.slice(brace + 1, e);
        }
        return decl;
      }
      if (brace === -1) continue;
      let depth = 0;
      let end = -1;
      for (let i = brace; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}' && --depth === 0) {
          end = i;
          break;
        }
      }
      if (end === -1) continue;
      return { file, kind, head, body: src.slice(brace + 1, end), name: typeName };
    }
  }
  return null;
}

/** 클래스 본문에서 **깊이 0 의 선언문**만 뽑는다 — 메서드 본문과 시그니처는 버린다. */
function topLevelStatements(body) {
  const out = [];
  let depth = 0;
  let buf = '';
  for (const ch of body) {
    if (ch === '{') {
      if (depth === 0) buf = '';
      depth++;
      continue;
    }
    if (ch === '}') {
      depth--;
      if (depth === 0) buf = '';
      continue;
    }
    if (depth !== 0) continue;
    if (ch === ';') {
      out.push(buf);
      buf = '';
      continue;
    }
    buf += ch;
  }
  return out;
}

/** 선언문이 인스턴스 필드면 그 이름, 아니면 null. */
function fieldNameOf(stmt) {
  const line = stmt.replace(/@\w+(\([^)]*\))?/g, ' ').replace(/=[\s\S]*$/, '').trim();
  if (!line || line.includes('(') || /\bstatic\b/.test(line)) return null;
  if (!/^(public|protected|private)?\s*(final\s+)?(transient\s+|volatile\s+)?[\w.<>,\[\]\s]+\s+\w+$/.test(line))
    return null;
  return line.split(/\s+/).pop();
}

/** 그 타입이 가진 생성자 인자 수 집합. 판단이 안 되면 null. */
function arities(decl) {
  const body = decl.body || '';
  const set = new Set();
  if (decl.kind === 'record') {
    set.add(decl.params);
    set.add(0);
  }

  // 명시 생성자 — 클래스 본문 깊이 1 에서 `Name(` 형태
  let depth = 0;
  const ctor = new RegExp('(?:^|[;{}\\s])(?:public|protected|private)?\\s*' + decl.name + '\\s*\\(', 'g');
  for (const m of body.matchAll(ctor)) {
    depth = 0;
    for (let i = 0; i < m.index; i++) {
      if (body[i] === '{') depth++;
      else if (body[i] === '}') depth--;
    }
    if (depth !== 0) continue;
    const open = body.indexOf('(', m.index);
    const close = matchParen(body, open);
    if (close === -1) continue;
    set.add(countArgs(body.slice(open + 1, close)));
  }

  const fields = topLevelStatements(body).map(fieldNameOf).filter(Boolean);

  if (ALL_ARGS.test(decl.head) && fields.length) set.add(fields.length);
  if (/@NoArgsConstructor\b/.test(decl.head)) set.add(0);
  // @Builder 는 다른 생성자가 없을 때 전 필드 생성자를 만든다
  if (/@Builder\b/.test(decl.head) && set.size === 0 && fields.length) set.add(fields.length);

  return set.size ? set : null;
}

/** 그 타입이 가진 인스턴스 필드 이름 집합. 상위 클래스를 따라 올라간다. */
function fieldNames(sources, typeName, seen = new Set()) {
  if (seen.has(typeName)) return new Set();
  seen.add(typeName);
  const decl = findDecl(sources, typeName);
  if (!decl) return null;
  const out = new Set();
  if (decl.kind === 'record') {
    const src = fs.readFileSync(decl.file, 'utf8');
    const m = blank(src).match(new RegExp('record\\s+' + typeName + '\\s*\\('));
    if (m) {
      const open = blank(src).indexOf('(', m.index);
      const close = matchParen(blank(src), open);
      for (const part of blank(src).slice(open + 1, close).split(',')) {
        const w = part.trim().split(/\s+/).filter(Boolean);
        if (w.length) out.add(w[w.length - 1]);
      }
    }
    return out;
  }
  for (const name of topLevelStatements(decl.body || '').map(fieldNameOf)) {
    if (name) out.add(name);
  }
  const ext = (decl.head + ' ' + (decl.body || '').slice(0, 0)).match(/extends\s+([\w$]+)/);
  const declLine = fs.readFileSync(decl.file, 'utf8');
  const em = declLine.match(new RegExp('class\\s+' + typeName + '\\b[^{]*extends\\s+([\\w$]+)'));
  const parent = em ? em[1] : ext ? ext[1] : null;
  if (parent) {
    const up = fieldNames(sources, parent, seen);
    if (up) for (const f of up) out.add(f);
  }
  return out;
}

/** Projections.fields/bean 에 넘긴 각 인자가 만드는 필드 이름. */
function argNames(inner) {
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of inner) {
    if ('([{<'.includes(ch)) depth++;
    else if (')]}>'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts.slice(1).map((piece) => {
    const t = piece.trim();
    // `.as("name")` 로 끝나거나 `ExpressionUtils.as(expr, "name")` 이면 그 이름이 필드명이다
    const alias = t.match(/\.as\(\s*"([^"]+)"\s*\)\s*$/) || t.match(/^ExpressionUtils\.as\([\s\S]*,\s*"([^"]+)"\s*\)$/);
    if (alias) return alias[1];
    if (t.includes('(')) return null;
    const m = t.match(/([\w$]+)\s*$/);
    return m ? m[1] : null;
  });
}

function main() {
  const list = process.argv.includes('--list');
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('사용법: node packs/stack-spring/bin/check-querydsl-projection-arity.js [--list] [--root <Java 소스>]');
    process.exit(0);
  }
  const src0 = resolve(process.argv);
  if (src0.error) {
    console.log(`건너뜀: ${src0.error}`);
    process.exit(0);
  }
  const ROOT = src0.javaRoot;

  // blank() 는 길이를 보존하므로 raw 를 같은 인덱스로 잘라 별칭 문자열을 읽을 수 있다
  const sources = javaFiles(ROOT).map((file) => {
    const raw = fs.readFileSync(file, 'utf8');
    return { file, raw, src: blank(raw) };
  });
  const cache = new Map();
  const bad = [];
  const unresolved = [];
  let checked = 0;

  for (const { file, src } of sources) {
    for (const m of src.matchAll(/Projections\.constructor\s*\(/g)) {
      const open = src.indexOf('(', m.index + 'Projections.constructor'.length - 1);
      const close = matchParen(src, open);
      if (close === -1) continue;
      const inner = src.slice(open + 1, close);
      const first = inner.split(',')[0].trim();
      const dot = first.match(/([\w$]+)\.class$/);
      if (!dot) continue;
      checked++;

      const type = dot[1];
      const passed = countArgs(inner) - 1;
      const rel = path.relative(WORKSPACE, file);
      const line = src.slice(0, m.index).split('\n').length;

      const key = file + '#' + type;
      if (!cache.has(key)) {
        const decl = findDecl(sources, type, file);
        cache.set(key, decl ? arities(decl) : null);
      }
      const want = cache.get(key);
      const where = rel + ':' + line;
      if (!want) {
        unresolved.push({ where, type, passed });
        continue;
      }
      if (list) console.log('  ' + where + '  ' + type + '  ' + passed + ' (가능: ' + [...want].sort((a, b) => a - b).join('/') + ')');
      if (!want.has(passed)) bad.push({ where, type, passed, want: [...want].sort((a, b) => a - b) });
    }
  }

  // Projections.fields / bean — 개수가 아니라 이름으로 맞춘다
  let namedChecked = 0;
  const badNames = [];
  const unresolvedNames = [];
  const fieldCache = new Map();
  for (const { file, src, raw } of sources) {
    for (const m of src.matchAll(/Projections\.(fields|bean)\s*\(/g)) {
      const open = src.indexOf('(', m.index + m[0].length - 1);
      const close = matchParen(src, open);
      if (close === -1) continue;
      const inner = src.slice(open + 1, close);
      const first = inner.split(',')[0].trim();
      const dot = first.match(/([\w$]+)\.class$/);
      if (!dot) continue;
      namedChecked++;
      const type = dot[1];
      const rel = path.relative(WORKSPACE, file);
      const line = src.slice(0, m.index).split('\n').length;
      const where = rel + ':' + line;
      if (!fieldCache.has(type)) fieldCache.set(type, fieldNames(sources, type));
      const have = fieldCache.get(type);
      const want = argNames(raw.slice(open + 1, close));
      if (!have || want.some((n) => n === null)) {
        unresolvedNames.push({ where, type });
        continue;
      }
      const missing = want.filter((n) => !have.has(n));
      if (list) console.log('  ' + where + '  ' + type + '  필드 ' + want.length + (missing.length ? ' ✗' : ''));
      if (missing.length) badNames.push({ where, type, missing });
    }
  }

  console.log('검사한 Projections.constructor ' + checked + '곳 · fields/bean ' + namedChecked + '곳');
  if (unresolvedNames.length) {
    console.log('\nfields/bean 판단 불가 ' + unresolvedNames.length + '곳: 직접 확인할 것');
    for (const u of unresolvedNames) console.log('  ' + u.where + '  ' + u.type);
  }
  if (badNames.length) {
    console.log('\n✗ fields/bean 에 대상 타입에 없는 필드명 ' + badNames.length + '건\n');
    for (const b of badNames) console.log('  ' + b.where + '  ' + b.type + ' : ' + b.missing.join(', '));
    bad.push(...badNames.map((b) => ({ where: b.where, type: b.type, passed: '-', want: ['이름 ' + b.missing.join('/')] })));
  }
  if (unresolved.length) {
    console.log('\n판단 불가 ' + unresolved.length + '곳: 직접 확인할 것 (실패로 치지 않는다)');
    for (const u of unresolved) console.log('  ' + u.where + '  ' + u.type + '  넘긴 인자 ' + u.passed);
  }

  if (bad.length === 0) {
    console.log('\n✓ 인자 수 불일치 없음');
    process.exit(0);
  }

  console.log('\n✗ 인자 수가 생성자와 어긋난 곳 ' + bad.length + '건: 그 쿼리를 만드는 순간 500 이 난다\n');
  for (const b of bad) {
    console.log('  ' + b.where);
    console.log('    ' + b.type + ' : 넘긴 인자 ' + b.passed + ' → 생성자 ' + b.want.join(' 또는 '));
  }
  console.log('\n  고치는 법: projection 인자를 DTO 생성자에 맞추거나, DTO 필드를 되살린다.');
  console.log('  ORDER BY 식은 select 컬럼일 필요가 없으므로 정렬 때문에 인자를 남겨둘 이유는 없다.');
  process.exit(1);
}

main();
