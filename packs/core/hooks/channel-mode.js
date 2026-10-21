#!/usr/bin/env node
// SessionStart 훅 (Claude Code) — 텔레그램 채널로 띄운 세션(aidure start 가 AIDURE_CHANNEL=1)이면 터미널과 텔레그램에 같은 내용을 남기라고 1줄로 알린다. 아니면 출력 없음. 항상 exit 0
/*
 * 플러그인 지시는 "보낸 사람은 텔레그램만 본다, reply 도구로만 보낸다" 라서 터미널에는 요약만 남는다. 사용자는 양쪽에서 같은 내용을 보고 결정한다.
 * 터미널에서 한 요청의 답은 Stop 훅(notify.js)이 텔레그램으로 보낸다. 그래서 여기서는 텔레그램에서 온 요청만 다룬다.
 */
'use strict';
const { run, context, root } = require('../lib/hook');
const notify = require('../lib/notify');

run(() => {
  if (process.env.AIDURE_CHANNEL !== '1') return;
  // 지금 알린 질문 방식을 적어 둔다. 세션 중에 바뀌면 notify.js 가 다음 요청 때 알린다
  try {
    const { readInput, safeId } = require('../lib/hook');
    const { stateDir } = require('../lib/workspace');
    const id = safeId(readInput().session_id);
    if (id) require('fs').writeFileSync(require('path').join(stateDir(root()), `${id}.away-mode`), notify.channelAskMode(root()) === 'text' ? 'away' : 'here');
  } catch { /* 부가 기능 */ }
  context('📱 텔레그램 채널 세션: 사용자는 터미널과 텔레그램 양쪽에서 같은 내용을 보고 결정한다. ' +
    '텔레그램에서 온 요청(<channel source="plugin:telegram:…"> 로 들어온 메시지)에 답할 때는 reply 로 보낸 것과 같은 전문을 터미널 응답에도 그대로 쓴다 (요약 · "텔레그램으로 보냈습니다" 로 대신하지 않는다). ' +
    '텔레그램은 표를 그리지 못한다. reply 로 보낼 때는 표 대신 "• 항목: 내용" 목록으로 쓴다 (터미널 응답은 평소대로 표를 써도 된다). ' +
    '터미널에서 온 요청은 reply 를 부르지 않는다 (끝나면 훅이 질문과 답을 텔레그램으로 보낸다). ' +
    '역할 에이전트 · 팀원이 일하는 동안 텔레그램에서 메시지가 오면 기다리게 두지 말고, 누가 무엇을 하고 있고 무엇이 끝났는지 두세 줄로 바로 답한다 (시작 · 끝은 훅이 한 줄씩 보낸다). ' +
    (notify.channelAskMode(root()) === 'text'
      ? '자리 비움: 결정은 질문 창 대신 결정 JSON 을 파일로 써서 node packs/core/bin/notify.js ask --file <파일> 로 보낸다 (결정마다 메시지 + 답 버튼, 권장안을 첫 보기로. 형식은 그 명령의 사용법). 터미널 응답에는 같은 결정을 번호 목록으로 쓴다. 답은 "1-1 ✅ 보기 이름" 같은 버튼 글자(앞의 1-1 이 답) · "1-1" · "2: 내용"(직접 입력) · "모두 권장안" 으로 오고, "<번호> ✏️ 직접 입력" 이 오면 notify.js prompt <번호> 를 부른 뒤 다음 메시지를 그 답으로 받는다. 답을 다 받으면 notify.js answered "<받은 답 요약>" 으로 버튼을 걷는다. 터미널이든 텔레그램이든 먼저 온 답으로 진행한다 (질문 창은 훅이 막는다). 텔레그램으로 보내는 10줄 넘는 결과 보고는 reply 대신 notify.js say(마크다운 stdin, 끝남 보고면 --done) 로 보낸다. '
      : '선택지는 평소대로 질문 창(권장안을 첫째에, 2~4개)으로 묻는다. 텔레그램에는 질문과 선택지가 알림으로 가고, 답은 터미널 창에서 고른다. ') +
    '사용자가 자리를 비운다 · 텔레그램으로 답하겠다고 하면 aidure notify my away on, 돌아왔다고 하면 aidure notify my away off 를 실행한다. ' +
    '알림이 많다 · 줄여 달라 · 다 보내 달라고 하면 aidure notify my level <all|decisions|progress|off> 로 바꾼다 (전체 · 결과와 결정 · 진행 현황 · 끄기). ' +
    '음성으로 들려 달라 · 음성 꺼 달라 · 결정만 음성으로 · 목소리를 바꿔 달라고 하면 aidure notify my voice on|off · scope both|decisions|done|all · name <목소리>(macOS 한국어: Yuna · Reed · Eddy · Flo 등) 로 바꾸고 voice test 로 들려준다. 모두 바로 적용된다. ' +
    '권한 확인은 플러그인이 텔레그램 버튼으로 보낸다.');
});
