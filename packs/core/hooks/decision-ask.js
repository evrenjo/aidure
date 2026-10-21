#!/usr/bin/env node
// 결정 질문 점검 (Claude Code) — 결정 질문(선택지 2개 이상)을 질문 창 없이 글로 끝내면 한 번 막고 질문 창으로 다시 묻게 한다
//   UserPromptSubmit: 이번 요청의 질문 창 사용 기록을 지운다 · PreToolUse(AskUserQuestion): 썼다고 적는다 · Stop: 판정 (막을 때만 block JSON)
// 수준은 agents.enforce.decisionAsk (off | block, 기본 block). 판정은 lib/notify.js looksLikeDecision (번호 선택지 2개 이상 + 권장 표시나 고르라는 말)
// 자리 비움인 채널 세션은 질문 창을 쓰지 않으므로 보지 않는다 (notify.js 가 텔레그램 버튼 질문으로 보내게 한다). 리모트 컨트롤로 이어져 있으면 본다
'use strict';
const fs = require('fs');
const path = require('path');
const { readInput, block, run, root, safeId } = require('../lib/hook');
const { stateDir, load } = require('../lib/workspace');

run(() => {
  const input = readInput();
  const id = safeId(input.session_id);
  if (!id) return;
  const ROOT = root();
  const mark = path.join(stateDir(ROOT), `${id}.asked`);
  const ev = String(input.hook_event_name || '');
  if (ev === 'UserPromptSubmit') { try { fs.unlinkSync(mark); } catch { /* 없음 */ } return; }
  if (ev === 'PreToolUse') { fs.writeFileSync(mark, '1'); return; }
  if (ev !== 'Stop' || input.stop_hook_active || fs.existsSync(mark)) return;
  const notify = require('../lib/notify');
  if (!notify.looksLikeDecision(input.last_assistant_message)) return;
  let ws = {};
  try { ws = load(ROOT); } catch { /* workspace.json 없음 */ }
  const cfg = notify.personal(ROOT, ws);
  if (process.env.AIDURE_CHANNEL === '1' && cfg.away && !(cfg.remote !== 'send' && notify.remoteControl(input.session_id))) return; // 리모트 컨트롤이면 앱에서 질문 창으로 답한다
  let level = 'block';
  try { const kit = require(path.join(ROOT, 'bin', 'kit.js')); level = (kit.resolveModels(ROOT, kit.loadWorkspace(ROOT)).enforce || {}).decisionAsk || level; } catch { /* 옛 워크스페이스 */ }
  if (level !== 'block') return;
  block('결정 질문을 글로 끝냈습니다. 사용자가 고를 것이 있으면 같은 내용을 질문 창(AskUserQuestion)으로 다시 묻습니다: 선택지 2~4개, 권장안을 첫째에 (권장) 과 이유 한 줄, 여러 개면 하나씩. 결정 질문이 아니었거나(단순 목록 · 보고) 사용자가 이미 정한 것이면 그대로 멈춥니다. 수준 바꾸기: aidure team-mode enforce ask off|block');
});
