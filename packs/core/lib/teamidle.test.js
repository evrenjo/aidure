// teamidle.js 점검: 팀원 승인 대기 기록 · 리더 쪽 판정 · 한 번만 알리기. 실행: node teamidle.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kedovi-teamidle-'));
process.env.CLAUDE_CONFIG_DIR = path.join(tmp, 'claude');
const ROOT = path.join(tmp, 'ws');
fs.mkdirSync(ROOT, { recursive: true });
const T = require('./teamidle');

// 리더 세션 abcdef12… 의 팀 = session-abcdef12, 팀원 analyst-1
const team = 'session-abcdef12';
fs.mkdirSync(path.join(process.env.CLAUDE_CONFIG_DIR, 'teams', team), { recursive: true });
fs.writeFileSync(path.join(process.env.CLAUDE_CONFIG_DIR, 'teams', team, 'config.json'), JSON.stringify({ leadAgentId: 'lead', members: [{ name: 'team-lead', agentId: 'lead', agentType: 'team-lead' }, { name: 'analyst-1', agentId: 'a1', isActive: true }] }));
const tr = path.join(tmp, 'teammate.jsonl');
fs.writeFileSync(tr, `${JSON.stringify({ agentName: 'analyst-1', teamName: team })}\n`);
const lead = { session_id: 'abcdef12-0000', transcript_path: '' };

// 팀원 세션 Notification (입력에 이름이 없어도 대화 기록 머리로 찾는다)
const t0 = Date.now() - 5 * 60000;
assert.deepStrictEqual(T.markWait(ROOT, { transcript_path: tr, message: 'Claude needs your permission to use Bash' }, t0), { team, name: 'analyst-1' });
fs.utimesSync(tr, new Date(t0 - 10000), new Date(t0 - 10000));   // 그 뒤 기록이 안 바뀜 = 아직 대기
const w = T.waitingApproval(ROOT, lead);
assert.strictEqual(w.length, 1);
assert.strictEqual(w[0].name, 'analyst-1');
assert.ok(w[0].minutes >= 4 && /permission/.test(w[0].msg));
assert.match(T.waitMessage(w), /analyst-1\(\d+분 · Claude needs/);
assert.strictEqual(T.waitWarned(ROOT, lead, 'analyst-1'), false, '처음은 알린다');
assert.strictEqual(T.waitWarned(ROOT, lead, 'analyst-1'), true, '같은 대기는 한 번만');
// 승인하고 일을 이어 가면(기록이 바뀜) 풀린다
fs.appendFileSync(tr, '{"type":"assistant"}\n');
assert.deepStrictEqual(T.waitingApproval(ROOT, lead), [], '기록이 바뀌면 풀림');
// 팀에 없는 이름은 적어도 리더 쪽에서 빠진다
T.markWait(ROOT, { team_name: team, teammate_name: 'gone', message: 'x' });
assert.deepStrictEqual(T.waitingApproval(ROOT, lead).map((x) => x.name), [], '종료된 팀원은 뺀다');
fs.rmSync(tmp, { recursive: true, force: true });
console.log('teamidle.test.js ✔');
