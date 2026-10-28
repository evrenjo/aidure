# handoffs: 개발자별 작업 인계

`{id}` = 이 워크스페이스 repo 의 `git config user.name`. 다른 개발자 폴더는 읽기만 하고 쓰지 않는다. `PLAN.md` 는 팀 공용이라 단계를 끝낸 사람이 상태를 고친다.

| 파일 | 무엇 |
|---|---|
| `handoffs/PLAN.md` | 로드맵: 프로젝트 전체 단계와 상태의 정본 (팀 공용). 그림은 `kedovi plan` |
| `handoffs/{id}/topics/<작업>.md` | 작업별 기록: 한 작업(티켓 · 요구사항 ID · 기능·화면)의 결정 · 원인 · 상태 · 남은 일. **미완 업무의 정본** (상태: 진행 중 + 완료 조건 `[ ]`) |
| `handoffs/{id}/YYYY-Www.md` | 주간 기록: 날짜마다 작업별 한두 줄 + 링크 |
| `handoffs/{id}/LATEST.md` | 마지막 상태 (재개가 먼저 읽는다, 4KB 이내) |
| `handoffs/{id}/TODO.md` | 사용자가 등록한 할 일 (사용자가 넣어 달라고 할 때만). 인수한 항목은 `← {원래 사람} 에게서 인수 (날짜)` |
| `handoffs/{id}/INDEX.md` | 작업 색인 (`node packs/core/bin/handoff.js index` 가 만든다) |
| `handoffs/{id}/archive/` | 오래된 주간 기록 (찾기 도구로만 본다) |

- 기록 찾기: `node packs/core/bin/handoff.js find <티켓·기능 이름>`
- 로드맵: `kedovi plan` (완료 보고 블록) · `kedovi plan --short` (한 줄) · `kedovi plan check` (갱신 누락)
- 팀 현황: `team-status` 스킬 또는 `kedovi team`
- 내 작업 재개: `resume` 스킬 ("재개")
- 다른 사람 작업 이어받기(인수인계): `takeover` 스킬 ("인수인계 <id>") 또는 `kedovi team <id>`
- 기록이 커졌으면: `handoff-organize` 스킬 ("핸드오프 정리")
