// 개인 알림 훅 — 알림 수준(.agents/local.json notify.level)에 맞춰 내 텔레그램으로 보낸다. 설정은 lib/notify.js. 출력은 아래 두 경우만.
/*
 * 수준: all 전체 · decisions 결과와 결정(기본) · progress 진행 현황 · off 끄기 (lib/notify.js LEVELS)
 *   UserPromptSubmit  요청 시작 시각 · 터미널 요청 문장을 적어 둔다
 *   Stop              요청 결과 (all: 질문 · 답 전문 / decisions: 답 앞부분 / progress: 끝남 한 줄). 팀원 · 리더의 백그라운드 작업이 남았으면 한 줄 덧붙인다 (lib/teamidle.js). 텔레그램에서 온 요청은 Claude 가 reply 로 답해 보내지 않는다
 *   Notification      결정 대기 (질문 · 권한 확인). 질문은 PreToolUse 에서 적어 둔 질문 · 선택지로. 팀원 세션의 승인 · 입력 대기도 (리더 화면에 안 보여서)
 *   PreToolUse(Agent) · SubagentStop · TeammateIdle   에이전트 시작 · 끝 · 대기 (all · progress)
 *   PC 앞에 있으면(키보드 · 마우스를 deskSeconds 안에 만짐, macOS) 끝남 · 에이전트 진행 · 음성은 보내지 않는다. 결정 대기 · 전체 수준 · 자리 비움은 그대로
 * 채널 세션(aikit start 가 AIKIT_CHANNEL=1)만:
 *   자리 비움이면 질문 창을 막고 텔레그램 버튼 질문(notify.js ask)으로 묻게 한다. 막을 때만 deny JSON 출력
 *   자리 비움인데 끝 응답이 결정 질문이고 이번 요청에 ask 를 안 보냈으면 Stop 을 한 번 막는다 (block JSON)
 *   수신 감시: 플러그인 서버가 끊기면 한 번 알린다. UserPromptSubmit 이면 Claude 에게도 평문으로 알린다 (자리 비움 전환 안내도)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { agent, readInput, run, safeId, root, deny, block, sessionStartedAt, isTeammate } = require('../lib/hook');
const { load, stateDir } = require('../lib/workspace');
const notify = require('../lib/notify');

run(async () => {
  const input = readInput();
  const ROOT = root();
  let ws = {};
  try { ws = load(ROOT); } catch { /* workspace.json 없음 */ }
  const cfg = notify.personal(ROOT, ws);
  const event = String(input.hook_event_name || '');
  const tool = String(input.tool_name || '');
  const id = safeId(input.session_id);
  const channel = process.env.AIKIT_CHANNEL === '1';
  // 리모트 컨트롤(Claude 앱)로 이어져 있으면 결정 · 입력 대기는 앱이 알린다: 결정은 질문 창으로 (자리 비움 무시), 텔레그램은 작업 끝 한 줄만 (quiet 면 그것도 쉼)
  const remote = cfg.remote !== 'send' && notify.remoteControl(input.session_id);
  if (remote) { cfg.away = false; if (cfg.remote === 'quiet') cfg.token = ''; }
  const can = !!(cfg.token && cfg.chat);
  const project = notify.projectName(ROOT, ws);
  const send = (text, opts) => (text && can && (!remote || (event === 'Stop' && /^✅/.test(text))) ? notify.send(text, cfg, 5000, opts).catch(() => {}) : null);
  const dir = stateDir(ROOT);
  const file = (ext) => (id ? path.join(dir, `${id}.${ext}`) : null);
  const rm = (f) => { try { if (f) fs.unlinkSync(f); } catch { /* 없음 */ } };
  const readFile = (f) => { try { return f ? fs.readFileSync(f, 'utf8') : null; } catch { return null; } };

  // 에이전트 시작 · 끝 · 대기 (전체 · 진행 현황)
  if ((event === 'PreToolUse' && /^(Agent|Task)$/.test(tool)) || event === 'SubagentStop' || event === 'TeammateIdle') {
    if (!notify.wantsProgress(cfg) || notify.atDesk(cfg)) return;
    const ti = input.tool_input || {};
    const line = (t, n = 160) => { const x = String(t || '').replace(/\s+/g, ' ').trim(); return x.length > n ? `${x.slice(0, n - 1)}…` : x; };
    await send(event === 'PreToolUse' ? `🧩 [${project}] ${ti.name || ti.subagent_type || '에이전트'} 시작: ${line(ti.description || ti.prompt)}`
      : event === 'SubagentStop' ? `✓ [${project}] ${input.agent_type || '에이전트'} 끝${input.last_assistant_message ? `: ${line(input.last_assistant_message, 200)}` : ''}`
        : `💤 [${project}] ${input.teammate_name || '팀원'} 일 끝, 대기 중`);
    return;
  }

  // 질문 도구: 자리 비움인 채널 세션은 막는다 (창은 터미널에서만 답할 수 있다). 아니면 질문 · 선택지를 적어 두고 결정 대기 알림에 쓴다
  if (event === 'PreToolUse') {
    if (channel && cfg.away) {
      deny('사용자가 자리를 비워 텔레그램으로 결정한다. 선택지 창을 쓰지 않는다. 같은 질문을 결정 JSON({ "decisions": [{ "title", "context", "options": [{ "label", "detail" }], "recommended": 0 }] })으로 파일에 써서 node packs/core/bin/notify.js ask --file <파일> 로 보내고(결정마다 메시지 + 답 버튼, 권장안을 첫 보기로), 터미널 응답에도 같은 내용을 번호 목록으로 쓴 뒤 답을 기다린다. 텔레그램 reply 로 같은 글을 또 보내지 않는다.');
      return;
    }
    const q = ((input.tool_input && input.tool_input.questions) || [])[0];
    const opts = ((q && q.options) || []).map((o, i) => `${i + 1}. ${o.label || o}`);
    const text = [String((q && (q.question || q.header)) || '질문'), ...opts, ...(opts.length && channel ? ['(터미널에서 방향키로 선택)'] : [])].join('\n');
    if (file('ask')) fs.writeFileSync(file('ask'), text);
    return;
  }
  if (event === 'PostToolUse') {
    if (/telegram.*reply/i.test(tool)) { if (file('replied')) fs.writeFileSync(file('replied'), '1'); } else rm(file('ask'));
    return;
  }

  // 채널 수신 감시 (요청 시작 · 끝). 시작 직후는 서버가 뜨는 중일 수 있어 30초 뒤부터
  if (channel && can && id && (event === 'UserPromptSubmit' || event === 'Stop')) {
    const started = sessionStartedAt(input);
    if (!started || Date.now() - started > 30000) {
      const down = file('channel-down');
      const h = notify.channelHealth(ROOT);
      if (!h.ok && !fs.existsSync(down)) {
        fs.writeFileSync(down, h.reason);
        // 팀원 막기(bun 대리 실행)가 없는 세션이면 다시 시작하라고 덧붙인다: 그 전까지는 팀원을 띄울 때마다 또 끊긴다
        const guarded = String(process.env.PATH || '').split(path.delimiter).includes(path.join(notify.channelDir(ROOT), 'aikit-bin'));
        await send(`⚠️ [${project}] 텔레그램 채널 끊김: ${h.reason}\n바로 할 일: 터미널에서 /mcp → plugin:telegram → Reconnect (안 되면 세션을 끝내고 aikit start -c)${guarded ? '' : '\n팀원이 수신을 가져가지 않게 하려면 세션을 끝내고 aikit start -c 로 다시 시작 (팀원 막기가 켜진다)'}`);
      } else if (h.ok && fs.existsSync(down)) {
        rm(down);
        await send(`✅ [${project}] 텔레그램 채널 다시 연결됨`);
      }
      if (!h.ok && event === 'UserPromptSubmit') process.stdout.write(`⚠️ 텔레그램 채널이 끊겼다 (${h.reason}). 이 요청을 처리하기 전에 사용자에게 한 줄로 알린다: 터미널에서 /mcp → plugin:telegram → Reconnect, 안 되면 세션을 끝내고 aikit start -c 로 이어서 시작.\n`);
    }
  }

  if (event === 'UserPromptSubmit') {
    if (!id) return;
    fs.writeFileSync(file('turn'), String(Date.now())); // 결과 알림 · 진행 현황(channel-progress.js)의 기준 시각
    for (const ext of ['ask', 'prompt-sent', 'replied', 'wait-sent']) rm(file(ext));
    const prompt = String(input.prompt || '');
    if (prompt.trim() && !/<channel\b/.test(prompt)) fs.writeFileSync(file('prompt'), prompt); // 텔레그램에서 온 것은 Claude 가 reply 로 답한다
    else rm(file('prompt'));
    // 자리 비움이 세션 중에 바뀌었으면 이번 요청부터 따르게 Claude 에게 알린다
    if (channel) {
      const mode = cfg.away ? 'away' : 'here';
      const was = readFile(file('away-mode'));
      if (was !== mode) {
        fs.writeFileSync(file('away-mode'), mode);
        if (was) process.stdout.write(cfg.away
          ? '📱 사용자가 자리를 비웠다. 지금부터 결정은 질문 창 대신 node packs/core/bin/notify.js ask (결정마다 메시지 + 답 버튼, 권장안 1번)로 보내고, 텔레그램에서 온 답(1-1 · 2: 내용 · ✏️)으로 진행한다.\n'
          : '🖥 사용자가 돌아왔다. 지금부터 선택지는 질문 창(권장안 첫째, 2~4개)으로 묻는다.\n');
      }
    }
    return;
  }

  if (event === 'Stop') {
    // 자리 비움인 채널 세션: 끝 응답이 결정 질문인데 이번 요청에서 ask 를 보내지 않았으면 한 번 막고 ask 로 보내게 한다 (질문 창이 없는 경로 · 지시를 놓친 경우)
    if (channel && cfg.away && !input.stop_hook_active && notify.looksLikeDecision(input.last_assistant_message)) {
      const turn = Number(readFile(file('turn'))) || 0;
      const asked = Number(readFile(path.join(dir, 'last-ask.sent'))) || 0; // notify.js ask 가 전송에 성공했을 때만 남긴다
      if (asked < turn || !turn) {
        block('사용자가 자리를 비워 텔레그램으로 결정한다. 방금 쓴 결정 질문을 결정 JSON({ "decisions": [{ "title", "context", "options": [{ "label", "detail" }], "recommended": 0 }] })으로 파일에 써서 node packs/core/bin/notify.js ask --file <파일> 로 보낸다 (권장안을 첫 보기로). 터미널 응답은 그대로 두고 보냈다는 한 줄만 더한 뒤 답을 기다린다.');
        return;
      }
    }
    const prompt = readFile(file('prompt'));
    const continued = !prompt && fs.existsSync(file('prompt-sent') || '');
    if (prompt) { rm(file('prompt')); if (file('prompt-sent')) fs.writeFileSync(file('prompt-sent'), '1'); }
    let elapsed = null;
    const turn = Number(readFile(file('turn')));
    if (turn) elapsed = (Date.now() - turn) / 1000;
    // 남은 것(일하는 · 대기 팀원, 리더의 백그라운드 작업): 자리에 있으면 일하는 것이 남은 동안 끝 알림을 쉬고, 자리 비움이면 한 줄 덧붙인다
    let w = null;
    try { const T = require('../lib/teamidle'); w = T.waiting(input); w.line = T.summary(w); } catch { /* 부가 기능 */ }
    const pending = !!(w && ((w.bg || []).length || (w.working || []).length));
    let text = notify.personalMessage(cfg, input, { project, agent: agent(), elapsed, prompt, replied: fs.existsSync(file('replied') || ''), continued, desk: notify.levelOf(cfg) !== 'all' && notify.atDesk(cfg), pending });
    if (text && w && w.line && !notify.brief(cfg)) text += `\n${w.line}`;
    if (text && /^❓/.test(text) && file('wait-sent')) fs.writeFileSync(file('wait-sent'), '1'); // 곧 뜰 질문 창 알림과 겹치지 않게
    rm(file('ask'));
    // 답 버튼 걷기: 결정 질문(ask)을 이번 요청 전에 보냈고(= 그 뒤에 답이 왔다) 이번 끝 응답이 새 결정 질문이 아니면, 에이전트가 answered 를 잊었어도 끝남 알림이 걷는다
    const lastAsk = path.join(dir, 'last-ask.json');
    const askedAt = Number(readFile(path.join(dir, 'last-ask.sent'))) || 0;
    const clear = notify.shouldClearKeyboard({ pending: fs.existsSync(lastAsk), askedAt, turn, last: input.last_assistant_message });
    if (clear) rm(lastAsk);
    if (clear && !text && can) await send(notify.answeredMessage('').text, { html: true, markup: { remove_keyboard: true } });
    else await send(text, clear ? { markup: { remove_keyboard: true } } : undefined);
    // 음성 (켜 둔 사람만): 끝남 보고를 짧게 읽어 준다
    if (text && can && !remote) await notify.sendSpeech(ROOT, cfg, 'done', notify.doneSpeech(input.last_assistant_message || text)).catch(() => {});
    return;
  }

  // 팀원 창의 승인 · 입력 대기: 리더 화면에 안 보이므로 알림 수준과 상관없이 바로 알린다 (결정 대기와 같은 급)
  if (event === 'Notification' && isTeammate(input)) {
    if (cfg.source === 'off') return;   // 알림을 끈 사람은 보내지 않는다 (리더 쪽 훅의 알림은 그대로)
    const w = require('../lib/teamidle').who(input);
    await send(`🔐 [${project}] 팀원 ${w ? w.name : ''} 이(가) 자기 창에서 승인 · 입력을 기다리며 멈춰 있습니다${input.message ? `: ${String(input.message).slice(0, 160)}` : ''}\n그 팀원 창(tmux)에서 승인해야 일을 시작합니다`);
    return;
  }
  if (event === 'Notification') {
    if (notify.brief(cfg) && fs.existsSync(file('wait-sent') || '') && notify.waitKind(input, readFile(file('ask'))) === 'question') return; // 선택 대기를 이미 알렸다
    await send(notify.personalMessage(cfg, input, { project, agent: agent(), question: readFile(file('ask')) }));
  }
}, { teammateEvents: ['TeammateIdle', 'Notification'] });
