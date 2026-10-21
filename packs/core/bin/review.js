#!/usr/bin/env node
// 리뷰 확인 (commit · push 전에 리뷰를 거쳤나): 지금 상태 · 리뷰했다고 기록 · 한 번 생략. 실행: aidure review <명령> 또는 node packs/core/bin/review.js <명령>
/*
 * 명령
 *   status [--repo R]                 수준 · 대상 repo 마다 마지막 리뷰 기록과 리뷰 안 된 줄 수 (commit 기준 = 작업 폴더 · push 기준 = HEAD)
 *   mark [--repo R] [--by "<누가>"]    지금 상태를 리뷰했다고 기록 (훅이 알 수 없는 방법으로 리뷰했을 때: 사람이 봄 · 다른 도구)
 *   skip --reason "<사유>" [--repo R]  다음 commit · push 한 번은 확인을 건너뛴다 (1시간 안). 사용자가 승인했을 때만
 * 수준 · 대상은 aidure team-mode enforce review off|warn|block [--repos a,b|*] [--min-lines N] [--paths p1,p2] (기본 꺼짐)
 * 기록은 이 PC 의 임시 상태 폴더에 둔다. 리뷰 기록은 reviewer 위임 · 교차 검토 · reviewer 역할 에이전트 때 자동으로도 남는다 (lib/review.js)
 */
'use strict';
const R = require('../lib/review');
const { load } = require('../lib/workspace');

const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null; };
const die = (m) => { console.error(`✖ ${m}`); process.exit(1); };

const ws = load();
const ROOT = ws.root;
const st = R.settings(ROOT);
const LEVEL = { off: '꺼짐', warn: '경고', block: '막기' };
const repos = () => {
  const list = R.scope(ws, st);
  const name = opt('repo');
  if (name && !list.some((r) => r.name === name)) die(`대상 repo 에 '${name}' 이 없습니다 (${list.map((r) => r.name).join(' · ') || '대상 없음'})`);
  return name ? list.filter((r) => r.name === name) : list;
};

if (cmd === 'status' || !cmd) {
  console.log(`리뷰 확인  ${LEVEL[st.level]}${st.level === 'off' ? ' (켜기: aidure team-mode enforce review warn --team)' : ''} · 대상 ${st.repos.join(', ')} · 기준 ${st.minLines}줄${st.paths.length ? ` · 경로 ${st.paths.join(', ')}` : ''}`);
  const list = repos();
  if (!list.length) console.log('  대상 repo 가 없습니다 (workspace.json repos 의 코드 · 기획 repo 중 repos/ 에 있는 것)');
  for (const r of list) {
    const c = R.measure(ROOT, r, st, 'commit');
    const p = R.measure(ROOT, r, st, 'push');
    const last = c && c.last;
    const n = (x) => (x ? `${x.unreviewed}줄${x.unreviewed > st.minLines ? ' ⚠' : ''}` : '볼 수 없음');
    console.log(`  ${r.name}  리뷰 안 된 변경: commit ${n(c)} · push ${n(p)} · 마지막 리뷰 ${last ? `${R.when(last.at)}${last.by ? ` (${last.by})` : ''}` : '없음'}`);
  }
  const skips = (R.read(ROOT).skips || []).length;
  if (skips) console.log(`  생략 표시 ${skips}개 (다음 commit · push 에 한 번씩 쓴다)`);
} else if (cmd === 'mark') {
  const done = R.record(ROOT, ws, st, { by: opt('by') || '직접 기록', names: repos().map((r) => r.name) });
  console.log(Object.keys(done).length ? `✔ 리뷰했다고 기록: ${Object.keys(done).join(' · ')} (지금 상태 기준. 뒤에 고치면 고친 만큼 다시 센다)` : '기록할 대상 repo 가 없습니다');
} else if (cmd === 'skip') {
  const reason = opt('reason');
  if (!reason) die('사용: aidure review skip --reason "<사유>" [--repo R]  (사용자가 생략을 승인했을 때만)');
  const name = opt('repo');
  if (name) repos();
  R.addSkip(ROOT, { reason, repo: name });
  console.log(`✔ 다음 commit · push 한 번은 리뷰 확인을 건너뜁니다${name ? ` (${name})` : ''} · 사유: ${reason}`);
} else {
  console.log(require('fs').readFileSync(__filename, 'utf8').split('\n').slice(2, 10).map((l) => l.replace(/^ \* ?/, '')).join('\n'));
  process.exit(1);
}
