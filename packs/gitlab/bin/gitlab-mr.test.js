// gitlab-mr.js pipeline 점검 (로컬 가짜 API): 목록 · 단계별 작업 · 실패 로그 · MR 머지 커밋 · --repo 생략 · 수동 작업 실행 · 다시 실행 · remove_source 제안 · 출력에 토큰 없음. 실행: node gitlab-mr.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const TOKEN = 'glpat-test-pipeline-0001';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kedovi-gitlab-'));
const seen = [];
const pipe = (id, status, ref, sha) => ({ id, status, ref, sha, source: 'push', created_at: '2026-01-02T03:04:05.000Z', web_url: `http://git.test/p/${id}`, duration: 75, user: { username: 'dev' } });
const routes = {
  '/projects/7/pipelines': (q) => (q.get('sha') === 'aaa1111bbb' ? [pipe(12, 'failed', 'main', 'aaa1111bbb')] : q.get('ref') === 'none' ? [] : [pipe(12, 'failed', 'main', 'aaa1111bbb'), pipe(11, 'success', 'main', 'ccc2222ddd')]),
  '/projects/7/pipelines/12': () => pipe(12, 'failed', 'main', 'aaa1111bbb'),
  '/projects/7/pipelines/12/jobs': () => [
    { id: 102, stage: 'deploy', name: 'publish', status: 'failed', duration: 9, web_url: 'http://git.test/j/102' },
    { id: 101, stage: 'test', name: 'unit', status: 'success', duration: 61, web_url: 'http://git.test/j/101' },
    { id: 103, stage: 'deploy', name: 'lint', status: 'failed', allow_failure: true, duration: 3, web_url: 'http://git.test/j/103' }],
  '/projects/7/jobs/102/trace': () => 'step 1\n\u001b[31mnpm ERR! 403 Forbidden\u001b[0m\n\nERROR: Job failed: exit code 1\n',
  '/projects/7/jobs/103/trace': () => 'lint warn\n',
  '/projects/7/merge_requests/5/pipelines': () => [],
  '/projects/7/merge_requests/5': () => ({ iid: 5, merge_commit_sha: 'aaa1111bbb', sha: 'eee' }),
};
// 수동 작업: deploy(202) 는 앞 작업(build 201)이 끝나기 전 created → 끝나면 manual → play 뒤 pending → running → success. 21 은 앞이 실패해 skipped
const jobState = { buildPolls: 0, deployPolls: 0, played: false, retried: false, newPolls: 0 };
const deployJob = () => ({ id: 202, stage: 'deploy', name: 'deploy', status: jobState.played ? (jobState.deployPolls++ < 1 ? 'pending' : jobState.deployPolls < 3 ? 'running' : 'success') : jobState.buildPolls >= 2 ? 'manual' : 'created', duration: 42, web_url: 'http://git.test/j/202' });
Object.assign(routes, {
  '/projects/7/pipelines/20': () => pipe(20, 'running', 'release', 'fff3333aaa'),
  '/projects/7/pipelines/20/jobs': () => { jobState.buildPolls += 1; return [{ id: 201, stage: 'build', name: 'build', status: jobState.buildPolls >= 2 ? 'success' : 'running' }, deployJob()]; },
  '/projects/7/jobs/202': () => deployJob(),
  '/projects/7/pipelines/21': () => pipe(21, 'failed', 'release', 'fff4444aaa'),
  '/projects/7/pipelines/21/jobs': () => [{ id: 211, stage: 'build', name: 'build', status: 'failed' }, { id: 212, stage: 'deploy', name: 'deploy', status: 'skipped' }],
  '/projects/7/jobs/104': () => ({ id: 104, stage: 'deploy', name: 'publish', status: jobState.newPolls++ < 1 ? 'running' : 'failed', duration: 5, web_url: 'http://git.test/j/104' }),
});
const posts = {
  '/projects/7/jobs/202/play': () => { if (deployJob().status !== 'manual') return [400, { message: '400 Unplayable Job' }]; jobState.played = true; return [200, deployJob()]; },
  '/projects/7/jobs/102/retry': () => { jobState.retried = true; return [201, { id: 104, stage: 'deploy', name: 'publish', status: 'pending' }]; },
};
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  seen.push({ path: u.pathname, token: req.headers['private-token'], method: req.method });
  if (req.method === 'POST') {
    const ph = posts[u.pathname.replace(/^\/api\/v4/, '')];
    const [code, body] = ph ? ph() : [404, { message: '404 Not Found' }];
    res.writeHead(code, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(body));
  }
  const h = routes[u.pathname.replace(/^\/api\/v4/, '')];
  if (!h) { res.writeHead(404); return res.end('{"message":"404 Not Found"}'); }
  const body = h(u.searchParams);
  res.writeHead(200, { 'Content-Type': typeof body === 'string' ? 'text/plain' : 'application/json' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
});

function run(args, cwd) {
  return new Promise((resolve) => {
    const env = { ...process.env, KEDOVI_POLL_MS: '200', GITLAB_TOKEN: TOKEN, KEDOVI_CONFIG_DIR: path.join(tmp, 'config'), KEDOVI_SECRETS_BACKEND: 'file' };
    delete env.CLAUDE_PROJECT_DIR;
    const c = spawn(process.execPath, [path.join(__dirname, 'gitlab-mr.js'), ...args], { cwd, env });
    let out = '';
    c.stdout.on('data', (d) => { out += d; });
    c.stderr.on('data', (d) => { out += d; });
    c.on('close', (code) => resolve({ code, out }));
  });
}

server.listen(0, '127.0.0.1', async () => {
  try {
    const apiBase = `http://127.0.0.1:${server.address().port}/api/v4`;
    const one = path.join(tmp, 'one');
    const two = path.join(tmp, 'two');
    for (const d of [one, two]) fs.mkdirSync(d, { recursive: true });
    const repo = (name) => ({ name, gitlab: { host: `127.0.0.1:${server.address().port}`, projectId: 7, apiBase } });
    fs.writeFileSync(path.join(one, 'workspace.json'), JSON.stringify({ project: { name: 'one' }, repos: [repo('api'), { name: 'docs' }] }));
    fs.writeFileSync(path.join(two, 'workspace.json'), JSON.stringify({ project: { name: 'two' }, repos: [repo('api'), repo('web')] }));

    // 목록 + 맨 위 파이프라인의 작업 (단계 순서 = 작업 ID 순). --repo 생략: gitlab 설정이 하나뿐
    let r = await run(['pipeline'], one);
    assert.strictEqual(r.code, 0, r.out);
    assert.ok(/#12\t✖ failed\tmain\taaa1111/.test(r.out) && /#11\t✔ success/.test(r.out), r.out);
    assert.ok(r.out.indexOf('✔ unit') < r.out.indexOf('✖ publish'), '단계 순서');
    assert.ok(/✖ publish\tfailed\t9초\thttp:\/\/git\.test\/j\/102/.test(r.out) && /✖ lint\tfailed \(실패 허용\)/.test(r.out) && /1분 15초/.test(r.out), r.out);
    assert.ok(r.out.includes('--id 12 --log') && !r.out.includes('npm ERR'), '로그는 --log 일 때만');

    // 실패한 작업의 로그 끝부분 (색 코드 · 빈 줄 제거, 줄 수 제한)
    r = await run(['pipeline', '--id', '12', '--log', '1'], one);
    assert.ok(r.out.includes('| ERROR: Job failed: exit code 1') && !r.out.includes('npm ERR') && !r.out.includes('파이프라인 ('), r.out);
    r = await run(['pipeline', '--log'], one);
    assert.ok(r.out.includes('| npm ERR! 403 Forbidden') && !r.out.includes('\u001b['), r.out);

    // MR: MR 파이프라인이 없으면 머지 커밋의 파이프라인
    r = await run(['pipeline', '--mr', '!5'], one);
    assert.ok(/MR !5 머지 커밋 aaa1111/.test(r.out) && /#12\t✖ failed/.test(r.out), r.out);

    // JSON · 없음 · repo 가 여럿이면 --repo 필요
    r = await run(['pipeline', '--json', '--limit', '1'], one);
    const j = JSON.parse(r.out);
    assert.ok(j.repo === 'api' && j.detail.id === 12 && j.detail.jobs.length === 3 && j.detail.jobs[0].name === 'unit');
    r = await run(['pipeline', '--ref', 'none'], one);
    assert.ok(r.code === 0 && r.out.includes('(없음)'), r.out);
    r = await run(['pipeline'], two);
    assert.ok(r.code === 1 && r.out.includes('--repo 가 필요합니다 (api · web)'), r.out);
    r = await run(['pipeline', '--repo', 'web', '--limit', '1'], two);
    assert.strictEqual(r.code, 0, r.out);

    // 수동 작업 실행: --yes 없으면 확인 문구만 (끝 코드 3, POST 없음) → --yes 면 created 동안 기다렸다가 manual 이 되면 play → 끝까지 상태
    r = await run(['pipeline', '--id', '20', '--play', 'deploy'], one);
    assert.ok(r.code === 3 && /사용자 승인/.test(r.out) && /--yes/.test(r.out) && !seen.some((x) => x.method === 'POST'), r.out);
    jobState.buildPolls = 0;
    r = await run(['pipeline', '--id', '20', '--play', 'deploy', '--yes'], one);
    assert.ok(r.code === 0 && /앞 작업을 기다림 \(created\): build running/.test(r.out) && /▶ 실행 요청/.test(r.out) && /▶ running/.test(r.out) && /✔ deploy 성공/.test(r.out), r.out);
    assert.ok(seen.filter((x) => x.method === 'POST').length === 1, 'play 는 manual 이 된 뒤 한 번만');
    // 앞 작업 실패로 skipped · 없는 작업 · --id 없음
    r = await run(['pipeline', '--id', '21', '--play', 'deploy', '--yes'], one);
    assert.ok(r.code === 1 && /skipped/.test(r.out) && /실행할 수 없습니다/.test(r.out), r.out);
    r = await run(['pipeline', '--id', '21', '--play', 'nope', '--yes'], one);
    assert.ok(r.code === 1 && /있는 작업: build, deploy/.test(r.out), r.out);
    r = await run(['pipeline', '--play', 'deploy', '--yes'], one);
    assert.ok(r.code === 1 && /--id/.test(r.out), r.out);
    // 다시 실행: 실패한 작업 → 새 작업을 끝까지 보고 실패면 끝 코드 1 · 로그 안내
    r = await run(['pipeline', '--id', '12', '--retry', 'publish', '--yes'], one);
    assert.ok(r.code === 1 && jobState.retried && /새 작업 104/.test(r.out) && /✖ publish failed/.test(r.out) && /--log/.test(r.out), r.out);

    // remove_source_branch 제안: 설정의 영구 브랜치 · 원격 기본 브랜치만 지키고 main · master 를 늘 지키지 않는다
    const { defaultRemoveSource } = require('./gitlab-mr.js');
    const wsv = { vars: { branch: { develop: 'dev', release: 'rel' }, gitlab: { persistentBranches: ['keep'] } } };
    assert.deepStrictEqual(['dev', 'rel', 'keep', 'main', 'master', 'hotfix/x', 'feature/a'].map((b) => defaultRemoveSource(wsv, b, 'main')), [false, false, false, false, true, false, true]);
    assert.strictEqual(defaultRemoveSource(wsv, 'main', null), true);

    // 토큰은 헤더로만 가고 출력에 없다
    assert.ok(seen.length && seen.every((s) => s.token === TOKEN));
    const all = (await Promise.all([run(['pipeline', '--log'], one), run(['pipeline', '--json'], one), run(['pipeline', '--id', '999'], one)])).map((x) => x.out).join('\n');
    assert.ok(!all.includes(TOKEN) && /HTTP 404/.test(all));
    console.log('gitlab-mr.test.js OK');
  } catch (e) {
    console.error(e.stack || e.message);
    process.exitCode = 1;
  } finally {
    server.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
