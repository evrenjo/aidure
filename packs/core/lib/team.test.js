// 팀장 · 팀원 · 담당 repo 판정 (team.js) · 담당 밖 수정 막기 훅 (repo-guard.js) · 설정 안내 (settings-hint.js)
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const T = require('./team');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kedovi-team-'));
const put = (f, c) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), c); };
execFileSync('git', ['init', '-q', dir]);
execFileSync('git', ['-C', dir, 'config', 'user.name', 'git-name']);
const ws = {
  repos: [{ name: 'api', dir: 'repos/api' }, { name: 'web', dir: 'repos/web' }, { name: 'free', dir: 'repos/free' }],
  team: {
    admins: ['old-admin'],
    leads: [{ username: 'lead1', nickname: '길동' }],
    members: ['plain', { username: 'mem1', nickname: '민수', repos: ['api'] }, { username: 'mem2', nickname: '지은', repos: ['api'] }, { username: 'mem3', nickname: '철수', repos: ['web'] }],
  },
};
const as = (username) => put('.agents/local.json', JSON.stringify({ me: { username, source: 'test' } }));

// 구성: 옛 admins 문자열도 팀장, 옛 문자열 팀원은 명단만
const r = T.roster(ws);
assert.deepStrictEqual(r.leads.map((p) => p.username), ['lead1', 'old-admin']);
assert.deepStrictEqual(r.members.map((p) => p.username), ['plain', 'mem1', 'mem2', 'mem3']);
assert.strictEqual(T.callName(r.leads[0]), '길동');
assert.strictEqual(T.callName(r.leads[1]), 'old-admin', 'nickname 이 없으면 username');

// 나: 이 PC 기록이 없으면 git user.name, 옛 관리자 이름도 팀장
fs.rmSync(path.join(dir, '.agents'), { recursive: true, force: true });
assert.strictEqual(T.me(dir).username, 'git-name');
assert.strictEqual(T.me(dir).source, 'git user.name');
execFileSync('git', ['-C', dir, 'config', 'user.name', 'old-admin']);
assert.ok(T.whoAmI(dir, ws).lead, '옛 admins(git user.name)도 팀장');
execFileSync('git', ['-C', dir, 'config', 'user.name', 'git-name']);

// 저장소 계정을 확인한 PC: git user.name 으로 적힌 항목(문자열 · source git)만 git 이름으로 맞추고, 계정으로 적힌 항목은 계정으로만
as('someone-acct');
execFileSync('git', ['-C', dir, 'config', 'user.name', 'old-admin']);
assert.ok(T.whoAmI(dir, ws).lead, '문자열(옛 형식) 팀장은 git 이름으로도');
execFileSync('git', ['-C', dir, 'config', 'user.name', 'lead1']);
assert.ok(!T.whoAmI(dir, ws).lead, '계정으로 적힌 팀장(lead1)은 git 이름만 바꿔서는 안 된다');
assert.ok(T.whoAmI(dir, { ...ws, team: { leads: [{ username: 'lead1', source: 'git' }] } }).lead, 'source git 팀장은 git 이름으로도 (kedovi init 이 계정을 못 읽었을 때)');
execFileSync('git', ['-C', dir, 'config', 'user.name', 'git-name']);

// 담당: 같은 repo 를 여러 명이, 담당 없는 repo 는 누구나, 팀장은 모두
as('mem1');
const w = T.whoAmI(dir, ws);
assert.ok(!w.lead && w.nickname === '민수' && w.repos.join() === 'api');
assert.ok(T.repoAccess(dir, ws, 'api').ok, '담당 repo');
assert.ok(!T.repoAccess(dir, ws, 'web').ok, '남의 담당 repo');
assert.ok(T.repoAccess(dir, ws, 'free').ok, '담당이 없는 repo');
assert.deepStrictEqual(T.blockedRepos(dir, ws), ['web']);
as('mem2');
assert.ok(T.repoAccess(dir, ws, 'api').ok, '한 repo 에 두 번째 담당자');
as('lead1');
assert.deepStrictEqual(T.blockedRepos(dir, ws), [], '팀장은 모두');
as('stranger');
assert.deepStrictEqual(T.blockedRepos(dir, ws), ['api', 'web'], '명단 밖 사람은 담당 있는 repo 를 못 고친다');
as('mem1');
const msg = T.blockMessage('web', T.repoAccess(dir, ws, 'web'));
assert.ok(/철수님 담당/.test(msg) && /민수님은 고칠 수 없습니다/.test(msg) && /팀장\(길동 · old-admin\)/.test(msg), msg);

// 경로 → repo (링크로 들어온 repo 는 실제 경로로도)
const real = path.join(dir, 'outside-web');
fs.mkdirSync(real, { recursive: true });
fs.mkdirSync(path.join(dir, 'repos'), { recursive: true });
fs.symlinkSync(real, path.join(dir, 'repos', 'web'));
assert.strictEqual(T.repoOfPath(dir, ws, 'repos/web/a.txt'), 'web');
assert.strictEqual(T.repoOfPath(dir, ws, path.join(real, 'new', 'b.txt')), 'web', '실제 경로 · 아직 없는 파일');
assert.strictEqual(T.repoOfPath(dir, ws, 'handoffs/x.md'), null);

// 훅: 워크스페이스 모양으로 두고 입력 JSON 으로 돌린다
const KIT = path.resolve(__dirname, '..', '..', '..');
fs.writeFileSync(path.join(dir, 'workspace.json'), JSON.stringify({ project: { name: 't' }, packs: ['core'], ...ws, repos: ws.repos.map(({ name }) => ({ name })) }));
const hook = (name, input) => spawnSync(process.execPath, [path.join(KIT, 'packs', 'core', 'hooks', name), '--agent=codex'], { cwd: dir, input: JSON.stringify({ cwd: dir, ...input }), encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: dir, KEDOVI_STATE_DIR: path.join(dir, '.state') } }).stdout;
const denied = (input) => /"permissionDecision":"deny"/.test(hook('repo-guard.js', input));
assert.ok(!denied({ tool_name: 'Edit', tool_input: { file_path: path.join(dir, 'repos/api/a.txt') } }), '담당 repo 편집 통과');
assert.ok(denied({ tool_name: 'Write', tool_input: { file_path: path.join(dir, 'repos/web/a.txt') } }), '남의 repo 편집 막음');
assert.ok(denied({ tool_name: 'apply_patch', tool_input: { command: '*** Begin Patch\n*** Update File: repos/web/a.txt\n@@\n-x\n+y\n*** End Patch' } }), 'Codex apply_patch 막음');
assert.ok(!denied({ tool_name: 'apply_patch', tool_input: { command: '*** Begin Patch\n*** Add File: repos/api/n.txt\n+y\n*** End Patch' } }), 'Codex 담당 repo 통과');
assert.ok(denied({ tool_name: 'Bash', tool_input: { command: 'git -C repos/web commit -am x' } }), '셸 커밋 막음');
assert.ok(denied({ tool_name: 'Bash', tool_input: { command: 'cd repos/web && sed -i "" s/x/y/ a.txt' } }), '셸 sed -i 막음');
assert.ok(!denied({ tool_name: 'Bash', tool_input: { command: 'cat repos/web/a.txt && git -C repos/web log -1' } }), '셸 읽기 통과');
assert.ok(!denied({ tool_name: 'Bash', tool_input: { command: 'ls > /dev/null' }, cwd: path.join(dir, 'repos/web') }), '/dev/null 은 쓰기가 아니다');
assert.ok(denied({ tool_name: 'Bash', tool_input: { command: 'echo y > a.txt' }, cwd: path.join(dir, 'repos/web') }), '그 repo 안에서 파일 쓰기 막음');
as('lead1');
assert.ok(!denied({ tool_name: 'Write', tool_input: { file_path: path.join(dir, 'repos/web/a.txt') } }), '팀장 통과');

// 셸 판정: 쓰는 대상만 (따옴표 안 ; · 읽기 · pull 은 아님, sudo · find -delete · npm --prefix 는 봄)
const { writeTargets } = require('../hooks/repo-guard');
const wt = (c, cwd = '/w') => JSON.stringify(writeTargets(c, cwd));
assert.strictEqual(wt('cp repos/web/x repos/api/'), '["/w/repos/api"]', '복사 원본은 대상이 아니다');
assert.strictEqual(wt('git pull', '/w/repos/web'), '[]');
assert.strictEqual(wt('git commit -m "a; rm -rf repos/api"', '/w/repos/web'), '["/w/repos/web"]', '따옴표 안은 나누지 않는다');
assert.strictEqual(wt('sudo rm repos/web/a'), '["/w/repos/web/a"]');
assert.strictEqual(wt('find repos/web -name x -delete'), '["/w/repos/web"]');
assert.strictEqual(wt('npm --prefix repos/api install'), '["/w/repos/api"]');
assert.strictEqual(wt('sed -i "" s/x/y/ repos/web/a.txt'), '["/w/repos/web/a.txt"]', 'macOS sed -i 의 빈 인자');

// 설정 안내: 불만 + 주제어일 때만, 같은 세션에서 한 번
const { hints } = require('../hooks/settings-hint');
const map = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'settings-map.json'), 'utf8'));
const ids = (s) => hints(s, map).map((e) => e.id).join();
assert.strictEqual(ids('왜 자꾸 영어로 말해?'), 'language');
assert.strictEqual(ids('알림이 너무 많아'), 'notify-level');
assert.strictEqual(ids('시간 표시 끄고 싶어'), 'timestamp');
assert.strictEqual(ids('web repo 왜 수정 못 해?'), 'repo-owner');
assert.strictEqual(ids('이 함수 고쳐줘'), '', '불만이 아니면 없음');
assert.strictEqual(ids('왜 이 테스트가 실패해?'), '', '주제어가 설정과 무관하면 없음');
for (const q of ['왜 이 함수가 시간 초과 나지? console 로그', '로그인 할 수 있게 권한 체크 추가', '컴포넌트 너무 느려', 'searchParams 파싱이 왜', '규칙 엔진 코드에서 왜 null', '대기열 처리 안 해서', '자꾸 테스트가 깨지는데 리뷰 좀 해줘']) assert.strictEqual(ids(q), '', `작업 요청은 안내하지 않는다: ${q}`);
assert.strictEqual(ids('너무 길어 답변 좀 짧게 해'), 'style');
for (const e of map.entries) assert.ok(e.id && e.topic && e.say && e.cmd && e.scope, `설정 지도 항목 ${e.id}`) || new RegExp(e.topic, 'i');
as('mem1');
const out1 = hook('settings-hint.js', { session_id: 's1', prompt: '알림이 너무 많아 귀찮아' });
const out2 = hook('settings-hint.js', { session_id: 's1', prompt: '알림이 너무 많아 귀찮아' });
assert.ok(/kedovi notify my level/.test(out1) && /팀장\(길동 · old-admin\)/.test(out1), out1);
assert.strictEqual(out2.trim(), '', '같은 세션에서 다시 넣지 않는다');

fs.rmSync(dir, { recursive: true, force: true });
console.log('team.test.js ✔');
