// 레거시 도구 공용 설정 — workspace.json vars.asis.* 를 읽고 소스 파일 경로를 푼다. 단독 실행 대상 아님.
'use strict'
const fs = require('fs')
const path = require('path')

let cached = null
/** { root, asis: vars.asis } — 워크스페이스 밖(테스트 등)이면 root=cwd, asis={} */
function config() {
  if (cached) return cached
  let root = process.cwd()
  let asis = {}
  try {
    const ws = require(path.join(__dirname, '..', '..', 'core', 'lib', 'workspace.js')).load()
    root = ws.root
    asis = (ws.vars && ws.vars.asis) || {}
  } catch {
    // workspace.json 없음 — 인자로 준 경로만 쓴다
  }
  cached = { root, asis }
  return cached
}

/** 워크스페이스 루트 기준 경로 (절대 경로는 그대로). 빈 값이면 null. */
function wsPath(p) {
  if (!p) return null
  return path.isAbsolute(p) ? p : path.join(config().root, p)
}

/** 문자열·배열·쉼표 목록을 경로 배열로. */
function pathList(v) {
  if (!v) return []
  const arr = Array.isArray(v) ? v : String(v).split(',')
  return arr.map((s) => String(s).trim()).filter(Boolean).map(wsPath)
}

function walk(dir, name, out, depth = 0) {
  if (depth > 12 || out.length > 20) return
  let ents
  try {
    ents = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of ents) {
    if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'backup') continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full, name, out, depth + 1)
    else if (e.name.toLowerCase() === name) out.push(full)
  }
}

/**
 * 레거시 소스 파일 경로를 푼다: ① 그대로 존재 → ② vars.asis.sourceRoot 기준 상대 경로 → ③ sourceRoot 아래 파일명 검색.
 * 파일명이 여러 곳에 있으면 후보를 보여주고 멈춘다 (아무거나 고르지 않는다).
 */
function resolveSource(file) {
  if (fs.existsSync(file)) return file
  const src = wsPath(config().asis.sourceRoot)
  if (!src) throw new Error(`파일이 없습니다: ${file} (vars.asis.sourceRoot 미설정. 전체 경로를 주거나 workspace.json 에 설정)`)
  const joined = path.join(src, file)
  if (fs.existsSync(joined)) return joined
  const hits = []
  walk(src, path.basename(file).toLowerCase(), hits)
  if (hits.length === 1) return hits[0]
  if (!hits.length) throw new Error(`파일이 없습니다: ${file} (sourceRoot ${src} 아래에서도 못 찾음)`)
  throw new Error(`파일명이 여러 곳에 있습니다. 경로를 더 주세요:\n  ${hits.slice(0, 10).join('\n  ')}`)
}

/** --name 값. 값 없는 플래그면 true, 없으면 dflt. */
function arg(name, dflt) {
  const i = process.argv.indexOf('--' + name)
  if (i === -1) return dflt
  const v = process.argv[i + 1]
  return v && !v.startsWith('--') ? v : true
}

module.exports = { config, wsPath, pathList, resolveSource, arg }
