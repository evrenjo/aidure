// mermaid 문법 검사 (외부 모듈 없음): 문서 사이트와 같은 mermaid 파일(assets/mermaid/mermaid.min.js)을 vm 에 읽어 mermaid.parse 로 본다
/*
 * blocks(files) → [{ file, line, src }]: md 의 ```mermaid (~~~mermaid) 블록. line = 여는 줄 번호(1부터)
 * asciiArt(files) → [{ file, line }]: 상자 · 화살표 문자로 그린 그림이 든 코드 블록 (mermaid 로 바꾸라고 ⚠)
 * check(blocks) → Promise<[{ file, line, error }]>: 문법 오류만. mermaid 파일이 없거나 읽지 못하면 검사를 건너뛴다(빈 목록)
 * 브라우저 없이 parse 만 하므로 문법 오류만 잡는다 (그림 배치 오류 · 브라우저에서만 나는 오류는 못 잡는다). 화면(site.js)은 같은 오류를 원문과 함께 보여 준다
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const LIB = path.join(__dirname, '..', 'assets', 'mermaid', 'mermaid.min.js');

function blocks(files) {
  const out = [];
  for (const [file, text] of Object.entries(files)) {
    if (typeof text !== 'string' || !/\.md$/i.test(file)) continue;
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const m = /^ {0,3}(`{3,}|~{3,})\s*mermaid\s*$/i.exec(lines[i]);
      if (!m) continue;
      const body = [];
      let j = i + 1;
      for (; j < lines.length && !new RegExp(`^ {0,3}${m[1][0]}{${m[1].length},}\\s*$`).test(lines[j]); j++) body.push(lines[j]);
      out.push({ file, line: i + 1, src: body.join('\n') });
      i = j;
    }
  }
  return out;
}

// 그림 줄: 상자 · 선 문자, 세로 · 가로 화살표. 이런 줄이 3줄 이상인 코드 블록(언어 없음 · text)을 그림으로 본다
const ART = /[─━│┃┌┐└┘├┤┬┴┼═║╔╗╚╝▶▼◀▲►◄→←↑↓]|-{2,}>|<-{2,}|^\s*\|\s*$|^\s*v\s*$/;
function asciiArt(files) {
  const out = [];
  for (const [file, text] of Object.entries(files)) {
    if (typeof text !== 'string' || !/\.md$/i.test(file)) continue;
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const m = /^ {0,3}(`{3,}|~{3,})\s*([\w-]*)\s*$/.exec(lines[i]);
      if (!m) continue;
      let j = i + 1;
      let art = 0;
      for (; j < lines.length && !new RegExp(`^ {0,3}${m[1][0]}{${m[1].length},}\\s*$`).test(lines[j]); j++) if (ART.test(lines[j])) art++;
      if (art >= 3 && /^(|text|txt|plain|ascii)$/i.test(m[2])) out.push({ file, line: i + 1 });
      i = j;
    }
  }
  return out;
}

let lib;
/** mermaid 를 브라우저 없이 읽는다 (parse 에 필요한 최소한의 window · document) */
function load() {
  if (lib !== undefined) return lib;
  lib = null;
  try {
    const noop = () => {};
    const el = () => ({ style: {}, setAttribute: noop, appendChild: noop, remove: noop });
    const ctx = { console: { log: noop, info: noop, debug: noop, warn: noop, error: noop }, setTimeout, clearTimeout, queueMicrotask, structuredClone, URL, TextEncoder, TextDecoder, addEventListener: noop, removeEventListener: noop };
    ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
    ctx.navigator = { userAgent: 'node' };
    ctx.document = { createElement: el, createElementNS: el, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, addEventListener: noop, body: el(), documentElement: el() };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(LIB, 'utf8'), ctx, { filename: 'mermaid.min.js' });
    if (ctx.mermaid && typeof ctx.mermaid.parse === 'function') lib = ctx.mermaid;
  } catch { lib = null; }
  return lib;
}

/** 오류 문구를 한두 줄로 (mermaid 는 위치 표시 줄을 여러 줄로 낸다) */
const short = (e) => String((e && (e.message || e.str)) || e).split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 3).join(' | ').slice(0, 300);

// 문법 오류 문구만 ✖ 로 친다. 그 밖의 예외(브라우저에만 있는 기능 · HTML 라벨 정리 등)는 Node 에서 검사하지 못한 것이라 넘긴다
const SYNTAX = /parse error|lexical error|syntax error|no diagram type detected|unknown diagram|expecting /i;

async function check(list) {
  if (!list.length) return [];
  const m = load();
  if (!m) return [];
  const bad = [];
  for (const b of list) {
    try { await m.parse(b.src); } catch (e) { if (SYNTAX.test(short(e))) bad.push({ file: b.file, line: b.line, error: short(e) }); }
  }
  return bad;
}

module.exports = { blocks, check, asciiArt, LIB };
