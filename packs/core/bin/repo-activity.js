#!/usr/bin/env node
// repo 별 활동 요약 (핸드오프·재개용). 실행: node packs/core/bin/repo-activity.js [--since="midnight"] [--all] [--json]
/*
 * 대상: workspace.json repos + 워크스페이스 repo 자신.
 * 기본(--all 없음) = 핸드오프용
 *   - 완료 커밋: 본인 author(그 repo 의 user.email) + 푸시됨(@{u} 에서 도달) 만
 *   - 미푸시: @{u}..HEAD 의 본인 커밋 (진행 중으로 다룬다)
 *   - 미커밋 변경 파일 수
 * --all = 재개용 — 모든 브랜치·모든 author 의 커밋을 author 와 함께 보여준다 (남의 커밋을 내 것으로 오독하지 않게)
 * --since 기본값: 기본 모드 "midnight", --all 모드 "24 hours ago"
 */
'use strict';

const fs = require('fs');
const { load, allRepos, git } = require('../lib/workspace');

const args = process.argv.slice(2);
const opt = (k) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : null; };
const ALL = args.includes('--all');
const SINCE = opt('since') || (ALL ? '24 hours ago' : 'midnight');
const JSON_OUT = args.includes('--json');

const ws = load();
const rows = [];
for (const r of allRepos(ws)) {
  if (!fs.existsSync(r.dir) || git(r.dir, ['rev-parse', '--is-inside-work-tree']) !== 'true') { rows.push({ repo: r.name, missing: true }); continue; }
  const email = git(r.dir, ['config', 'user.email']) || '';
  const name = git(r.dir, ['config', 'user.name']) || '';
  const branch = git(r.dir, ['symbolic-ref', '--short', '-q', 'HEAD']) || git(r.dir, ['rev-parse', '--short', 'HEAD']);
  const upstream = git(r.dir, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  const dirty = (git(r.dir, ['status', '--porcelain']) || '').split('\n').filter(Boolean);
  const lines = (s) => (s || '').split('\n').filter(Boolean);
  const row = { repo: r.name, self: r.self, branch, upstream, author: email || name, dirty: dirty.length };
  if (ALL) {
    row.commits = lines(git(r.dir, ['log', '--all', `--since=${SINCE}`, '--pretty=%h %an%x09%s']));
  } else {
    const who = email ? [`--author=${email}`] : name ? [`--author=${name}`] : [];
    row.pushed = upstream ? lines(git(r.dir, ['log', `--since=${SINCE}`, ...who, '--pretty=%h %s', '@{u}'])) : [];
    row.unpushed = upstream ? lines(git(r.dir, ['log', ...who, '--pretty=%h %s', '@{u}..HEAD'])) : lines(git(r.dir, ['log', `--since=${SINCE}`, ...who, '--pretty=%h %s']));
    if (!upstream) row.note = 'upstream 없음: 모든 커밋을 미푸시로 본다';
  }
  rows.push(row);
}

if (JSON_OUT) { process.stdout.write(JSON.stringify({ since: SINCE, mode: ALL ? 'all' : 'mine', rows }, null, 2) + '\n'); process.exit(0); }

console.log(`# repo 활동 (${ALL ? '전체 author' : '본인·푸시 기준'}, since: ${SINCE})`);
for (const r of rows) {
  if (r.missing) { console.log(`\n=== ${r.repo}: 없음/ git 아님`); continue; }
  console.log(`\n=== ${r.repo}${r.self ? ' (워크스페이스)' : ''}  [${r.branch || '?'} → ${r.upstream || 'upstream 없음'}]  author=${r.author || '미설정'}  미커밋 ${r.dirty}`);
  if (ALL) { r.commits.forEach((c) => console.log(`  ${c}`)); if (!r.commits.length) console.log('  (커밋 없음)'); continue; }
  console.log(`  완료(푸시됨) ${r.pushed.length}건`); r.pushed.forEach((c) => console.log(`    ${c}`));
  console.log(`  진행 중(미푸시) ${r.unpushed.length}건`); r.unpushed.forEach((c) => console.log(`    ${c}`));
  if (r.note) console.log(`  ※ ${r.note}`);
}
