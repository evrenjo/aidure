// 확장자로 레거시 방언 파서를 고른다 — bin/dialects/*.js 를 자동 등록한다 (`_` 로 시작하는 파일 제외). 방언 추가법: docs/adding-a-dialect.md
'use strict'
const fs = require('fs')
const path = require('path')

const DIR = path.join(__dirname, 'dialects')
const REQUIRED = ['name', 'extensions', 'unit', 'parse', 'closure', 'effects', 'reads', 'fieldWrites', 'conditionsAt']

let registry = null
function load() {
  if (registry) return registry
  registry = new Map()
  for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.js') && !x.startsWith('_')).sort()) {
    const d = require(path.join(DIR, f))
    const missing = REQUIRED.filter((k) => !(k in d))
    if (missing.length) throw new Error(`방언 ${f} 에 필수 export 가 없습니다: ${missing.join(', ')}`)
    for (const ext of d.extensions) {
      const e = ext.toLowerCase()
      if (registry.has(e)) throw new Error(`확장자 ${e} 를 두 방언(${registry.get(e).name}, ${d.name})이 주장합니다`)
      registry.set(e, d)
    }
  }
  return registry
}

/** 파일 경로 → 방언 모듈. 모르는 확장자면 예외. */
function pick(file) {
  const ext = path.extname(file).toLowerCase()
  const d = load().get(ext)
  if (!d) throw new Error(`지원하지 않는 확장자: ${ext || '(없음)'} (지원: ${[...load().keys()].join(' ')})`)
  return d
}

module.exports = pick
module.exports.pick = pick
module.exports.dialects = () => [...new Set(load().values())]
module.exports.extensions = () => [...load().keys()]
