// repo 공개 여부: 로그인 정보 없이 받아지면 공개다 (GitHub · GitLab 등 호스트 무관, 토큰 불필요). 쓰는 곳: kedovi init (워크스페이스 repo 주소) · doctor
'use strict';
const { spawnSync } = require('child_process');

/** git 주소 → 익명으로 물어볼 https 주소 (git@host:a/b.git · ssh://git@host/a/b · https://user@host/a/b). 모르면 null */
function anonUrl(remote) {
  const v = String(remote || '').trim();
  let m = /^[^@\s/]+@([^:\s]+):(.+)$/.exec(v);
  if (m) return `https://${m[1]}/${m[2]}`;
  m = /^ssh:\/\/(?:[^@/]+@)?([^/:]+)(?::\d+)?\/(.+)$/.exec(v);
  if (m) return `https://${m[1]}/${m[2]}`;
  m = /^https?:\/\/(?:[^@/]+@)?(.+)$/.exec(v);
  if (m) return `https://${m[1]}`;
  return null;
}

/**
 * 공개 repo 인가: true = 누구나 받을 수 있음, false = 로그인해야 받음(비공개 · 내부), null = 알 수 없음(주소 · 네트워크)
 * 이 PC 의 저장된 인증(키체인 · Credential Manager)을 쓰지 않게 막고 묻는다
 */
function isPublic(remote, { timeout = 10000 } = {}) {
  const url = anonUrl(remote);
  if (!url) return null;
  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never', GIT_ASKPASS: 'true', SSH_ASKPASS: 'true' };
  const r = spawnSync('git', ['-c', 'credential.helper=', '-c', 'core.askPass=true', 'ls-remote', '--heads', '--', url], { encoding: 'utf8', env, timeout });
  if (r.status === 0) return true;
  const err = `${r.stderr || ''}`;
  if (/not found|Authentication failed|could not read Username|terminal prompts disabled|HTTP Basic|401|403|access denied|Unauthorized/i.test(err)) return false;
  return null;
}

module.exports = { anonUrl, isPublic };
