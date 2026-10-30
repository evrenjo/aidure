---
name: resume
description: 이 워크스페이스로 돌아왔을 때 본인 마지막 핸드오프·미완 작업·TODO·최근 활동·repo 상태를 한 번에 파악해 보고한다. 본인 작업 재개 전용이다. "재개", "어디까지 했지", "상태 파악" 요청에 쓴다.
---

# resume — 작업 재개 보고

상태 파악만 한다. 실제 작업은 사용자의 다음 지시로 시작한다.

> **인자로 다른 개발자 id 가 오면** 보고의 첫 줄에 반드시 "다른 개발자 작업을 이어받으려면 takeover(인수인계)를 쓰세요 — 지금은 본인({id}) 기준으로 재개합니다" 를 쓰고, 그 사람 폴더는 읽지 않는다.

## 0. 사전 점검

- `workspace.json` 의 repos 가 워크스페이스에 모두 있는지 본다:
  `node -e "const w=require('./packs/core/lib/workspace').load();for(const r of w.repos)console.log(require('fs').existsSync(r.dir)?'ok ':'없음',r.name)"`
- 하나라도 없으면 "⚠️ 셋업 깨짐 — doctor 스킬로 진단하세요" 만 알리고 멈춘다.
  단, `workspace.json` 에서 `local: true` 이고 `remote` 가 없는 repo 는 다른 팀원이 새로 만들어 아직 원격이 없는 것이다 — 깨짐이 아니라 "아직 원격 없음" 으로 보고하고 계속한다.

## 1. 본인 핸드오프

- `{id}` = 워크스페이스 루트 `git config user.name`. **대상은 항상 본인**이다.
- `handoffs/{id}/LATEST.md` 를 먼저 읽는다. 없으면 가장 최근 주간 파일(`handoffs/{id}/YYYY-Www.md`)의 마지막 날짜 섹션. 둘 다 없으면 "이전 핸드오프 없음 — 새 작업으로 시작할까요?"
- **남은 일의 정본은 작업별 기록**이다: 상태가 진행 중이고 `## 완료 조건` 에 `[ ]` 가 남은 기록이 미완 작업이다 (`node packs/core/bin/team-status.js --id {id} --no-fetch` 의 "미완 작업").
- `handoffs/{id}/TODO.md` 는 사용자가 등록한 할 일이다. 따로 "내 TODO" 로 보고한다. 미완 작업을 TODO 에 옮기지 않는다.
- `handoffs/{id}/INDEX.md`(작업 색인)로 진행 중인 작업을 확인하고, 이어서 할 작업의 `topics/<작업>.md` 는 **머리와 `## 요약` · `## 완료 조건` · `## 지킬 것`, 마지막 날짜 섹션만** 읽는다. 완료 조건의 미완 항목이 곧 이어서 할 일이다. 날짜 예약(`[>] YYYY-MM-DD`)은 그날 전에는 미완이 아니고, 그날이면 「오늘 예정」 · 지났으면 「지난 예약」 으로 보고 맨 앞에 적는다 (`node packs/core/bin/brief.js` 의 「날짜 예약」).
- 주간 파일은 통째로 읽지 않는다. 지난 기록이 필요하면 찾기 도구로 해당 줄만 본다: `node packs/core/bin/handoff.js find <티켓·기능 이름>`
- **새 요청이 예전에 한 작업(같은 화면·기능·티켓)과 이어지면**, 착수 전에 `find` 로 그 작업의 기록을 먼저 찾아 읽는다.

## 1.5 로드맵 (팀 공용)

```bash
node packs/core/bin/plan.js --short   # 완료 n/N · 지금 단계 · 다음
node packs/core/bin/plan.js check     # 갱신 누락 경고 (⚠ 줄)
```

- 추천 다음 작업은 로드맵의 "다음" · 미완 작업 · 내 TODO 를 함께 보고 고른다. ⚠ 가 나오면 보고에 적고, 단계 상태를 고칠지 사용자에게 묻는다 (직접 고치지 않는다).

## 2. 최근 활동 (24시간)

```bash
node packs/core/bin/repo-activity.js --all        # 모든 브랜치·모든 author, author 표시
```

- 본인 커밋과 다른 개발자 커밋을 **갈라서** 보고한다 (남의 커밋을 내 작업으로 오독하지 않게). 남의 커밋은 겹칠 가능성 판단용이다.

## 3. 현재 git 상태

```bash
node packs/core/bin/repo-activity.js              # 본인 기준: 미푸시(진행 중)·미커밋
```

- 미푸시 커밋·미커밋 변경은 "진행 중" 으로 보고한다.

## 4. 보고

```
재개 보고 ({id})
🗺 로드맵: {plan.js --short 한 줄} {⚠ 경고가 있으면 한 줄}
📌 마지막 핸드오프 (YYYY-MM-DD): handoffs/{id}/LATEST.md
- 진행 중: {1~2줄}
- 미완 작업: {작업 이름 (남은 [ ] 수) 또는 "없음"}
- 날짜 예약: {📅 오늘 예정 · ⚠ 지난 예약 · 다음 예약 날짜, 없으면 줄을 뺀다}
- 내 TODO: {TODO.md 항목 또는 "없음"}
🕑 최근 24h: 본인 {repo 별 요약} / 다른 개발자 {author + repo 별 요약}
📦 repo 상태: {repo 별 미푸시·미커밋}
➡️ 추천 다음 작업: {1~2건}  ·  주의: {겹칠 가능성 등}
```

- 토큰 절약 — 보통 LATEST.md · 미완 작업 목록 · TODO.md 면 충분하다.

