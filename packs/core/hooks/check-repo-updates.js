#!/usr/bin/env node
// SessionStart 훅 — 워크스페이스 repo + workspace.json repos 를 병렬 fetch 해 뒤처짐·미커밋을 알린다. 정상이면 1줄. 항상 exit 0
'use strict';

const fs = require('fs');
const { run, context, readInput, markSessionStart } = require('../lib/hook');
const { load, allRepos, devId, git, gitAsync } = require('../lib/workspace');
const { referenceStatus, describe } = require('../lib/refs');

run(async () => {
  const input = readInput();
  try { markSessionStart(input); } catch { /* 세션 표식은 부가 기능 */ }
  const ws = load();
  const id = devId(ws.root);
  const repos = allRepos(ws);

  const results = await Promise.all(repos.map(async (r) => {
    if (!fs.existsSync(r.dir)) return { name: r.name, state: 'missing' };
    if (git(r.dir, ['rev-parse', '--is-inside-work-tree']) !== 'true') return { name: r.name, state: 'not-git' };
    const branch = git(r.dir, ['symbolic-ref', '--short', '-q', 'HEAD']) || git(r.dir, ['rev-parse', '--short', 'HEAD']) || '(detached)';
    const fetched = await gitAsync(r.dir, ['fetch', '--quiet'], 10000);
    let upstream = git(r.dir, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
    if (!upstream && git(r.dir, ['rev-parse', '--verify', '--quiet', `origin/${branch}`])) upstream = `origin/${branch}`;
    const dirty = !!git(r.dir, ['status', '--porcelain']);
    if (!upstream) return { name: r.name, branch, state: 'no-upstream', dirty, fetchFailed: !fetched.ok };
    const behind = Number(git(r.dir, ['rev-list', '--count', `HEAD..${upstream}`]) || 0);
    const ahead = Number(git(r.dir, ['rev-list', '--count', `${upstream}..HEAD`]) || 0);
    return { name: r.name, branch, upstream, behind, ahead, dirty, fetchFailed: !fetched.ok, state: behind > 0 ? 'behind' : 'ok' };
  }));

  const who = id ? `개발자 ${id}` : '개발자 ID 미설정: 워크스페이스에서 git config user.name 설정';
  const behind = results.filter((r) => r.state === 'behind');
  const offline = results.filter((r) => r.fetchFailed);
  const broken = results.filter((r) => r.state === 'missing' || r.state === 'not-git');
  const ahead = results.filter((r) => r.ahead > 0);

  // 참고 자료가 비어 있으면 알린다 — 표의 경로만 보고 "문서가 있다" 고 답하는 실수를 막는다
  let refNote = '';
  try {
    const bad = referenceStatus(ws).filter((s) => s.state !== 'ok');
    if (bad.length) refNote = `\n⚠ 참고 자료 비어 있음·없음: ${bad.map(describe).join(' · ')}. 참고 자료 표의 경로는 위치일 뿐이다. 인용하기 전에 목록을 확인하고, 없으면 "문서 없음" 이라고 답한다.`;
  } catch { /* 부가 기능 */ }
  if (!behind.length && !offline.length && !broken.length && !ahead.length) {
    context(`✓ repo ${results.length}개 최신 · ${who}${refNote}`);
    return;
  }
  const out = [`## repo 업데이트 점검 (${results.length}개) · ${who}`, ''];
  if (behind.length || ahead.length) {
    out.push('| repo | 브랜치 | 뒤처짐 | 미푸시(ahead) | 미커밋 |', '|---|---|---|---|---|');
    for (const r of [...new Set([...behind, ...ahead])]) out.push(`| ${r.name} | ${r.branch} | ${r.behind} | ${r.ahead} | ${r.dirty ? '⚠️ 있음' : '없음'} |`);
    out.push('');
  }
  if (behind.length) out.push(`> 뒤처진 repo ${behind.length}개: 사용자에게 "pull 받을까요? (y/n/repo 이름)" 을 먼저 묻는다. y 면 미커밋 없는 repo 만 \`git pull --ff-only\`, 미커밋이 있는 repo 는 건너뛰고 사유를 알린다.`);
  if (ahead.length) out.push(`> 미푸시 커밋이 있는 repo ${ahead.length}개. 완료가 아니라 "진행 중" 으로 다룬다. 푸시는 사용자 지시가 있을 때만.`);
  if (offline.length) out.push(`> fetch 실패: ${offline.map((r) => r.name).join(', ')}: 오프라인·인증 문제일 수 있다. 한 줄 언급 후 진행.`);
  if (broken.length) out.push(`> 없음/깨짐: ${broken.map((r) => `${r.name}(${r.state})`).join(', ')}: \`node packs/core/bin/doctor.js\` 로 진단.`);
  if (refNote) out.push(refNote.trim());
  context(out.join('\n'));
});
