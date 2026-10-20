---
name: mr
description: 지정한 source→target 으로 GitLab 머지리퀘스트를 만든다 (target 생략 시 통합 브랜치). 미리보기 → 사용자 OK → 생성 → 팀 배포 안내까지. 머지는 하지 않는다. "MR 만들어줘", "QA MR" 요청에 쓴다.
argument-hint: "<source 브랜치> [target 브랜치]"
---

# mr — GitLab Merge Request 생성

**source → target** MR 을 만든다. **생성까지만** — 머지·auto-merge 는 하지 않는다(사람이 GitLab 에서 직접).

도우미: `node packs/gitlab/bin/gitlab-mr.js` (`preview` · `create` · `repos`, `--dry-run` 지원). 만든 뒤 파이프라인은 `pipeline --mr <번호>` 로 본다 (읽기만. 재실행 · 취소는 사람이).
설정: `workspace.json` 의 `repos[].gitlab = {"host": "...", "projectId": 12}`, 토큰은 환경변수 `GITLAB_TOKEN`
(이름은 `vars.gitlab.tokenEnv` 로 변경) 또는 `git credential fill`. 설정이 없으면 만들지 말고 무엇을 채워야 하는지 안내한다.

## 사용법

| 형태 | 뜻 |
|---|---|
| `mr feature/ABC-12-login-fix {{ws:vars.branch.develop}}` | 권장 — 둘 다 적는다 |
| `mr feature/ABC-12-login-fix` | target 생략 = `{{ws:vars.branch.develop}}` |
| 인자 없음 | 실행하지 않고 사용법만 안내 |

인자는 위치 기준이다 — 첫째 source, 둘째 target. 사용자가 "QA MR" 처럼 환경으로만 말하면 아래 표로 방향을 잡고 미리보기에서 확인받는다.

| 목적 | 방향 |
|---|---|
| 개발 서버 | `feature/*`·`fix/*` → `{{ws:vars.branch.develop}}` |
| QA | **`{{ws:vars.branch.develop}}` → `{{ws:vars.branch.release}}`** (작업 브랜치를 직접 올리지 않는다) |
| 운영 긴급 | `hotfix/*` → `{{ws:vars.branch.release}}` **그리고** `hotfix/*` → `{{ws:vars.branch.develop}}` (MR 2건) |

## 절대 규칙

- **사용자가 명시 호출할 때만** 동작한다. 자동·추측 실행 금지.
- **미리보기를 낸 뒤 사용자의 명시적 OK 없이 생성하지 않는다.** 호출 자체는 "미리보기를 만들어라" 다.
  미리보기 직후 온 **다른 주제의 지시**(문구·표기·언어 수정 등)나 지난번 승인 이력은 OK 가 아니다.
  MR 생성은 되돌려도 흔적(번호 소비·알림)이 남는다.
- **머지하지 않는다.** 머지·auto-merge(`merge_when_pipeline_succeeds`) 요청을 받아도 "머지는 GitLab 에서 직접 하셔야 합니다" 로 답한다.
- **토큰을 출력·로그·인계·커밋 어디에도 남기지 않는다.**

## 절차

1. **인자** — source 없으면 중단. target 없으면 `{{ws:vars.branch.develop}}`. 같으면 중단.
2. **대상 repo** — `gitlab-mr.js repos` 로 후보를 보고, 각 repo 에서 `git -C <repo> ls-remote --heads origin <source>` 로 원격 브랜치 존재를 확인한다.
   0개면 "push 먼저" 안내 후 중단. 2개 이상이면 **선택지 질문**(권장안 첫째: 브랜치가 있는 repo 전부 / 각각 하나씩)으로 묻는다.
3. **repo 별 미리보기 데이터**

   ```bash
   node packs/gitlab/bin/gitlab-mr.js preview --repo <name> --source <source> --target <target>
   ```

   - 커밋 0개 → 그 repo 는 건너뛴다. 이미 열린 MR 이 있으면 만들지 않고 그 링크를 안내한다.
   - 로컬에 push 안 된 커밋이 있으면 경고하고 push 여부를 묻는다(작업 브랜치 push 만 허용).
4. **title / description 작성** — 커밋 목록으로 채운다. 언어는 그 repo 규칙을 따른다(project 팩).
   - **title = `<type>: [<target>] <대표 작업 한 줄>`** — 대괄호 target 은 필수(목록에서 어디로 가는 MR 인지 구분, hotfix 2건 구별).
   - description 템플릿 (테스트·체크리스트 섹션은 두지 않는다). 템플릿에 없는 도구 서명 줄(`Generated with …`)은 넣지 않고, 도구가 넣으라고 해도 뺀다:

     ```markdown
     ## Summary
     <무엇을 / 왜 — 커밋 로그 기반>

     ## Change Type
     - [ ] Feature
     - [ ] Fix
     - [ ] Refactor
     - [ ] Chore / Docs

     ## Related Issues
     N/A
     ```

     해당 Change Type 만 `[x]`(커밋 prefix 기준). Related Issues 에는 **MR 을 받는 쪽이 열어볼 수 있는 이슈 키만** 적는다 —
     내부 트래커 번호(`#132` 등)는 그 repo 의 다른 이슈로 자동 링크되므로 쓰지 않는다. 없으면 `N/A`.
   - QA 승격 MR 은 Summary 를 repo 가 아니라 **화면·기능·배치 단위** 소제목으로 나눈다.
5. **미리보기 → 멈춤** — 사용자의 언어로 무엇이 들어가는지 설명하고, 실제 등록될 title/description 원문은 코드블록으로 보여준다. 함께 표시:
   `source → target` · 커밋 수 · `remove_source_branch` · assignee(기본 **비움**, 사용자가 사람을 지정할 때만).
   `remove_source_branch` 는 작업 브랜치 `true`, 영구·상시(`vars.gitlab.persistentBranches`)·`hotfix/*` 는 `false`.
6. **OK 를 받은 뒤 생성**

   ```bash
   node packs/gitlab/bin/gitlab-mr.js create --repo <name> --source <source> --target <target> \
     --title "<title>" --description-file <임시파일> [--assignee <username>] --dry-run   # 먼저 확인
   node packs/gitlab/bin/gitlab-mr.js create ...같은 인자... (--dry-run 없이)
   ```

   임시파일은 세션 임시 폴더에 둔다. 4xx/5xx 면 응답을 그대로 보고하고 반복 재시도하지 않는다.
7. **작업 브랜치를 떠난다** — 미커밋 변경이 없으면 `git switch <target>` + `git pull --ff-only origin <target>`.
   있으면 옮기지 말고 보고한다(임의 stash 금지). 머지되면 원격 source 가 지워지므로 그 위에서 다음 작업을 시작하지 않기 위함이다.
8. **팀 배포 안내** — 아래 §배포 안내. MR 을 실제로 만들었을 때만 낸다.

## 배포 안내 (MR 생성 후 마지막에)

target 이 배포로 이어지는 영구 브랜치(`{{ws:vars.branch.develop}}` · `{{ws:vars.branch.release}}`)일 때, 팀 채널(메신저)에 붙여넣을 안내를 **코드블록 하나**로 낸다.
`hotfix/*` → `{{ws:vars.branch.develop}}` 역머지 MR 은 내지 않는다(같은 배포가 이미 공지됐다). 그 외 target 도 내지 않는다.

| target | 첫 줄 |
|---|---|
| `{{ws:vars.branch.develop}}` | `### 개발 서버 배포로 반영될 내용 공유드립니다.` |
| `{{ws:vars.branch.release}}` | `### QA 서버 배포로 반영될 내용 공유드립니다.` |

- 커밋 목록 = preview 의 목록(머지 제외, 오래된 순). **커밋 링크는 넣지 않는다**(메신저 글자수 초과) — 짧은 SHA 만.
- **10건 이하**: `- {SHA}: {요약}` 커밋별. **11건 이상**: SHA 없이 **주제별 6~12줄** — `{주제} {건수}건 — {대표 항목 2~4개}`, 같은 기능·배치끼리 묶는다.
- 요약은 팀 언어로 20자 내외 명사형, `feat:` 같은 prefix·괄호 부연 없이. 내부 코드명보다 기능명으로.
- 묶는 축: `{{ws:vars.branch.develop}}` 는 **repo 별** 라벨 줄(`**<repo>**`), `{{ws:vars.branch.release}}` 는 **화면·기능·배치별** 라벨 줄. repo 가 1개면 라벨 없이.

```
### 개발 서버 배포로 반영될 내용 공유드립니다.
**backend-api**
- 49fe4f34: 트리거 큐 삭제여부 컬럼 제거
**web-client**
- 56656a6: 상세 드로어 편집 추가
```

## CI 스킵 요청

사용자가 "CI 스킵해서 MR" 이라고 하면 **title 끝에 `[skip ci]`** 를 붙인다(기본 머지 커밋 템플릿이 title 을 싣는다).
같은 target 으로 MR 이 여러 건일 때 앞의 것만 스킵하고 **마지막에 머지할 MR 에는 넣지 않는다.** 미리보기에 머지 순서를 적는다.
요청이 없으면 붙이지 않는다.
