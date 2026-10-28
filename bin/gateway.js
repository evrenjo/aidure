'use strict';
/**
 * AI 게이트웨이 찾기 · 모델 목록 조회 (kedovi init · install · ai 가 쓴다). 의존성 없음.
 *
 * 게이트웨이 = 여러 회사 모델을 한 주소로 주는 중계 서버 (LiteLLM · OpenRouter · 사내 LLM 프록시 등).
 * 키 값은 읽어서 조회에만 쓰고 어디에도 저장하지 않는다. 저장하는 것은 주소 · 찾은 곳 · 모델 ID 목록뿐.
 *
 * 찾는 순서: 셸 환경변수 → Claude Code 설정(~/.claude/settings.json 의 env) → Codex 설정(~/.codex/config.toml 의 model_providers)
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const OFFICIAL = /(^|\.)anthropic\.com$|(^|\.)openai\.com$|(^|\.)chatgpt\.com$/;
const hostOf = (url) => { try { return new URL(url).host; } catch { return ''; } };
const isOfficial = (url) => OFFICIAL.test(hostOf(url).replace(/:\d+$/, ''));
/** 키를 보내도 되는 주소: https, 또는 이 PC 안(localhost) 의 http */
const safeUrl = (url) => { try { const u = new URL(url); return u.protocol === 'https:' || (u.protocol === 'http:' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(u.hostname)); } catch { return false; } };
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };

/** Claude Code 쪽 — ANTHROPIC_BASE_URL 이 공식 주소가 아니면 게이트웨이 */
function fromClaudeEnv(env, source) {
  const url = env.ANTHROPIC_BASE_URL;
  if (!url || isOfficial(url)) return null;
  const keyName = ['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_API_KEY'].find((k) => env[k]);
  return {
    source, url: url.replace(/\/+$/, ''), keyName: keyName || null, key: keyName ? env[keyName] : null,
    // 별칭(opus · sonnet · haiku · fable)이 게이트웨이 모델로 이어져 있으면 킷 프로필의 별칭을 그대로 쓸 수 있다
    aliases: ['OPUS', 'SONNET', 'HAIKU'].every((f) => env[`ANTHROPIC_DEFAULT_${f}_MODEL`]),
  };
}

/** Codex 쪽 — 쓰는 model_provider 의 base_url (공식 주소가 아니면). 키는 env_key 가 가리키는 환경변수만 쓴다 */
function fromCodexConfig(file, env) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return null; }
  const provider = (text.match(/^\s*model_provider\s*=\s*"([^"]+)"/m) || [])[1];
  if (!provider) return null;
  const esc = provider.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const block = (text.split(new RegExp(`^\\s*\\[model_providers\\.${esc}\\]\\s*$`, 'm'))[1] || '').split(/^\s*\[/m)[0];
  const url = (block.match(/^\s*base_url\s*=\s*"([^"]+)"/m) || [])[1];
  if (!url || isOfficial(url)) return null;
  const keyName = (block.match(/^\s*env_key\s*=\s*"([^"]+)"/m) || [])[1] || null;
  return { source: `Codex 설정 (model_provider ${provider})`, url: url.replace(/\/+$/, '').replace(/\/v1$/, ''), keyName, key: keyName ? env[keyName] || null : null, aliases: false };
}

/** 찾은 게이트웨이 후보 (주소가 같은 것은 하나로, 키가 있는 쪽 우선) */
function detect({ env = process.env, home = os.homedir() } = {}) {
  const found = [
    fromClaudeEnv(env, '셸 환경변수'),
    fromClaudeEnv(((readJson(path.join(home, '.claude', 'settings.json')) || {}).env) || {}, 'Claude Code 설정 (~/.claude/settings.json)'),
    fromCodexConfig(path.join(env.CODEX_HOME || path.join(home, '.codex'), 'config.toml'), env),
  ].filter(Boolean);
  const byUrl = new Map();
  for (const g of found) {
    const cur = byUrl.get(g.url);
    if (!cur || (!cur.key && g.key)) byUrl.set(g.url, { ...g, aliases: g.aliases || (cur && cur.aliases) || false });
  }
  return [...byUrl.values()];
}

/** 모델 목록 조회 — GET <주소>/v1/models (Anthropic · OpenAI 형식 둘 다 data[].id). 반환 { ok, models, error } */
async function listModels(url, key, { timeoutMs = 15000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const headers = { 'anthropic-version': '2023-06-01' };
    if (key) { headers.authorization = `Bearer ${key}`; headers['x-api-key'] = key; }
    const res = await fetch(`${url.replace(/\/+$/, '')}/v1/models`, { headers, signal: ctrl.signal });
    if (!res.ok) return { ok: false, models: [], error: `HTTP ${res.status}` };
    const body = await res.json();
    const list = Array.isArray(body) ? body : body.data || body.models || [];
    const models = [...new Set(list.map((m) => (typeof m === 'string' ? m : m.id || m.slug)).filter(Boolean))].sort();
    return models.length ? { ok: true, models } : { ok: false, models: [], error: '모델 목록이 비어 있습니다' };
  } catch (e) {
    return { ok: false, models: [], error: e.name === 'AbortError' ? '시간 초과' : e.message };
  } finally { clearTimeout(t); }
}

/** 목록을 회사별로 묶기 (화면 표시용) */
function groupModels(models) {
  const g = { claude: [], gpt: [], other: [] };
  for (const m of models) {
    const tail = m.split('/').pop().toLowerCase();
    (tail.startsWith('claude') ? g.claude : /^(gpt|o\d|codex)/.test(tail) ? g.gpt : g.other).push(m);
  }
  return g;
}

/** 저장할 값 — 키는 넣지 않는다 */
const toSaved = (g, models, today = new Date().toISOString().slice(0, 10)) => ({ url: g.url, source: g.source, keyEnv: g.keyName || null, aliases: !!g.aliases, models, checked: today });

module.exports = { detect, listModels, groupModels, toSaved, isOfficial, safeUrl };
