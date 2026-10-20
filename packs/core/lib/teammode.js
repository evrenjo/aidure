// 역할 에이전트 실행 방식 판정 (Claude Code): 팀 모드(agent teams 의 팀원 세션)인가 서브에이전트인가. 환경과 설정만 읽고 아무것도 바꾸지 않는다.
/*
 * 팀 모드 = Claude Code agent teams (env CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1). 표시 방식은 settings.json 의 teammateMode:
 *   tmux: tmux 가 설치돼 있으면 팀원 창. tmux 세션 밖에서 시작했으면 Claude Code 가 세션을 만들고 입력창 오른쪽에 이름을 보여 준다 (다른 터미널에서 tmux attach -t <이름>). 미설치면 서브에이전트
 *   auto: tmux 가 있으면 창, 없으면 같은 터미널 안(in-process) · in-process(기본): 같은 터미널 안 · iterm2: iTerm2 창 (it2 는 확인하지 않는다)
 * 쓰는 곳: hooks/team-mode.js (세션 시작 · 요약 뒤 알림) · hooks/agent-budget.js (이름 없는 역할 에이전트 막기)
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return {}; } };
const settingFiles = (ROOT) => [path.join(ROOT, '.claude', 'settings.local.json'), path.join(ROOT, '.claude', 'settings.json'), path.join(os.homedir(), '.claude', 'settings.json')];
function setting(ROOT, key) { for (const f of settingFiles(ROOT)) { const v = readJson(f)[key]; if (v !== undefined) return v; } return undefined; }
function envValue(ROOT, name) {
  if (process.env[name] !== undefined) return String(process.env[name]);
  for (const f of settingFiles(ROOT)) { const e = readJson(f).env || {}; if (e[name] !== undefined) return String(e[name]); }
  return undefined;
}
const tmuxInstalled = () => (process.env.PATH || '').split(path.delimiter).some((d) => d && fs.existsSync(path.join(d, 'tmux')));

/** → { team: 팀 모드인가, verdict: 사용자에게 보일 판정 문구 } */
function judge(ROOT) {
  const on = envValue(ROOT, 'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS') === '1';
  const mode = String(setting(ROOT, 'teammateMode') || 'in-process');
  const inside = !!process.env.TMUX;
  const installed = tmuxInstalled();
  let verdict;
  if (!on) verdict = '서브에이전트 · 사유: 팀 기능 꺼짐 (~/.claude/settings.json 의 env CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 로 켠다)';
  else if (mode === 'tmux') verdict = installed ? `팀 모드 (tmux 창${inside ? '' : '. 세션 밖이라 Claude Code 가 tmux 세션을 만든다. 입력창 오른쪽의 세션 이름으로 다른 터미널에서 tmux attach -t <이름>'})` : '서브에이전트 · 사유: tmux 미설치 (brew install tmux 뒤 다시 시작, 또는 teammateMode 를 in-process 로)';
  else if (mode === 'auto') verdict = installed ? `팀 모드 (tmux 창${inside ? '' : ', 세션은 Claude Code 가 만든다'})` : '팀 모드 (같은 터미널 안, in-process)';
  else if (mode === 'iterm2') verdict = '팀 모드 (iTerm2 창, it2 CLI 필요)';
  else verdict = '팀 모드 (같은 터미널 안, in-process)';
  return { team: verdict.startsWith('팀 모드'), verdict };
}

/** 이름 없는 역할 에이전트 검사 수준 (off | warn | block). bin/kit.js resolveModels 의 enforce. 옛 워크스페이스면 block */
function nameCheck(ROOT) {
  try {
    const kit = require(path.join(ROOT, 'bin', 'kit.js'));
    return (kit.resolveModels(ROOT, kit.loadWorkspace(ROOT)).enforce || {}).teammateName || 'block';
  } catch { return 'block'; }
}

module.exports = { judge, nameCheck };
