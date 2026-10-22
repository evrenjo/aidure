// issue-check.js 점검: 비밀값 · 개인 경로 · 이메일 · 사설 IP · 금지 낱말을 줄 번호로만 알리고 exit 1, 깨끗하면 exit 0. 실행: node issue-check.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { privateHits } = require('./issue-check.js');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aidure-issue-check-'));
try {
  fs.writeFileSync(path.join(tmp, 'workspace.json'), JSON.stringify({ project: { name: 'x' }, repos: [], vars: { issue: { forbid: ['acme', '고객사'] } } }));
  const run = (text) => {
    const f = path.join(tmp, 'body.md');
    fs.writeFileSync(f, text);
    const env = { ...process.env };
    delete env.CLAUDE_PROJECT_DIR;
    const r = spawnSync(process.execPath, [path.join(__dirname, 'issue-check.js'), '--file', f], { cwd: tmp, env, encoding: 'utf8' });
    return { code: r.status, out: r.stdout + r.stderr };
  };

  let r = run('## 현상\n로그인이 안 됩니다\n자세한 내용: https://example.com/docs\n');
  assert.ok(r.code === 0 && r.out.includes('0건'), r.out);

  const secret = `${'sk-ant-'}abcdefghijklmnop0123`;
  r = run(`첫 줄\n${secret}\n/Users/somebody/work/a.log 에서\nmail me: dev@corp.example.com\n서버 10.1.2.3 접속\nACME 쪽 요청\n고객사 화면\nnoreply 1+x@users.noreply.github.com\n`);
  assert.strictEqual(r.code, 1, r.out);
  for (const s of ['2줄: Anthropic 키 모양', '3줄: 개인 경로', '4줄: 이메일', '5줄: 사설 IP', '6줄: 금지 낱말', '7줄: 금지 낱말']) assert.ok(r.out.includes(s), `${s}\n${r.out}`);
  assert.ok(!r.out.includes('8줄') && !r.out.includes(secret) && !r.out.includes('somebody'), r.out);

  // ASCII 금지 낱말은 낱말 경계로만 (다른 낱말 속은 넘김), 공개 IP 는 넘김
  assert.deepStrictEqual(privateHits('acmeCorp 8.8.8.8 172.32.0.1', ['acme']), []);
  console.log('issue-check.test.js OK');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
