# aidure 킷 repo — 작업 지침

이 repo 는 **킷 자체**다. 프로젝트 워크스페이스가 아니다. 여기서 고친 팩·생성기·템플릿이
`aidure init` / `aidure upgrade` 를 통해 **여러 프로젝트의 워크스페이스로 퍼진다.** 한 줄 실수가 모든 프로젝트에 복제된다.

> Claude Code 는 `CLAUDE.md` 가 이 파일을 가져온다. Codex 는 이 파일을 직접 읽는다.

## 구조

| 경로 | 내용 | 비고 |
|---|---|---|
| `bin/kit.js` | 생성 엔진 — init · install · sync · check · upgrade | **의존성 없음 유지** (워크스페이스에 복사돼 pre-commit 이 쓴다) |
| `bin/aidure.js` | 전역 CLI — 선택 화면 · install · start | `@clack/prompts` 만 쓴다 |
| `bin/selftest.js` | 킷 자체 점검 (`npm test`) | |
| `bin/models.js` | 모델 카탈로그 점검·추천 표 생성 (`npm run models` · `models:doc`) | 의존성 없음 |
| `bin/docs.js` | 킷 문서 사이트 `docs-site/` 생성 (`npm run docs`): 프로젝트 문서 사이트와 같은 생성기(`packs/core/lib/mdsite.js`), 메뉴는 루트 `docs-site.json`. md 가 원본, HTML 은 생성물 | 의존성 없음 |
| `packs/<팩>/` | 룰 · 스킬 · 훅 · 도구 | 규격 = `docs/pack-making.md` |
| `packs/core/stacks.json` | 스택 감지 목록 — 새 기술은 여기 한 줄 | layer·stack 팩과 짝 |
| `templates/workspace/` | 새 워크스페이스 뼈대 (`project` 팩 포함) | |
| `templates/docs-repo/` | 기획자 repo 뼈대 (`aidure init-docs`) | 킷이 렌더하지 않는다 — `{{ws:…}}` 금지 |
| `docs/` | 문서 사이트 원본(사용자용) + 킷 개발 문서 | `README.md` 와 `docs/*.md` 가 모두 사이트에 들어가고, 메뉴 묶음은 루트 `docs-site.json` 의 `groups`(어느 묶음에도 없는 문서는 `npm test` 가 잡는다). README 는 소개 · 설치만 두고 나머지는 주제별 문서로. 킷 개발 내용은 「킷 개발」 묶음의 `kit-dev.md`(새 팩 · 스택 목록) · `model-catalog.md` 로. `workflow.md` = 설치부터 작업까지 흐름도 (화면과 한 쌍) · `model-catalog.md` = 새 모델 조사 절차 · `quickstart.md` = 빠른 시작 · `packs.md` = 팩 종류(모든 팩 목록은 `npm run docs` 가 생성) · `pack-making.md` = 팩 제작 · 팩 작성 규격 · `commands.md` = 명령 · `team-models.md` = 팀 에이전트와 모델 (추천 표 생성 위치) |

## 반드시 지킨다

1. **특정 프로젝트·사내 프레임워크의 관례를 표준처럼 넣지 않는다** (응답 봉투·오류 코드 체계·메시지 키 등) — "그 프로젝트의 기존 관례를 찾아 따른다" 로 쓰고 예시는 `docs/example-*.md` 로.
   **특정 프로젝트 이름·경로·계정·호스트를 넣지 않는다.** 프로젝트마다 다른 값은 `{{ws:vars.…}}` 변수로, 기본값은 `pack.json` 의 `vars`.
   실제 프로젝트에서 쓰다 고친 내용은 그 프로젝트 용어가 섞여 들어오기 쉽다. 금지 낱말 검사는 `npm test` 가 한다 (목록은 repo 밖: `AIDURE_BANNED` · `~/.config/aidure/banned.txt`).
2. **스킬·룰은 도구 중립으로 쓴다.** Claude 전용 도구 이름(`AskUserQuestion`, `subagent_type`, `TodoWrite`, `$CLAUDE_PROJECT_DIR`)을 쓰지 않는다.
   두 도구가 다르게 동작해야 하는 절차만 `> Claude Code:` / `> Codex:` 로 나눈다. 대응표는 `docs/pack-making.md`.
3. **always 룰은 예산을 쓴다.** 팩당 약 6KB, 전체 팩을 켠 워크스페이스의 `AGENTS.md` 가 32KB(Codex 기본 한도) 안이어야 한다.
   새 규칙은 먼저 on-demand 나 `docs/` 로 둘 수 있는지 본다. 더 먼저, **규칙 대신 검사 도구(훅·pre-commit·`bin/`)로 만들 수 있는지** 본다.
4. **훅 출력 계약을 지킨다.** SessionStart 는 평문 1줄(정상이면), Stop 은 JSON 이거나 빈 출력, PreToolUse 는 막을 때만 deny JSON. 훅은 예외를 삼키고 항상 exit 0 — `packs/core/lib/hook.js` 를 쓴다.
5. **`bin/kit.js` 는 Node 기본 모듈만 쓴다.** 워크스페이스에 복사돼 npm 설치 없이 돌아야 한다. 대화형·색이 필요한 것은 `bin/aidure.js` 로.
6. **생성 규칙을 바꾸면 하위 호환을 본다.** 이미 만들어진 워크스페이스가 `aidure upgrade` 한 번으로 새 규칙에 맞춰져야 한다.
   `workspace.json` 필드를 없애거나 뜻을 바꾸면 upgrade 가 옛 값을 옮기게 하고, 못 하면 sync 가 무엇을 고치라고 알려야 한다.
7. **`packs/*/lib/workspace.js` · `workspace.py` 와 `bin/kit.js` 의 파생 규칙은 한 쌍이다** (repo 위치 `repos/<이름>` · `repos/<그룹>/<이름>` = `repoRel`, `asis.sourceRoot` 파생 등). 한쪽만 고치지 않는다.

8. **화면 문구·문서에 장식용 대시(—)를 쓰지 않는다.** 설명은 쌍점·마침표·괄호로, 제목은 짧게(설명은 제목 아래 한 줄).
   문서 제목 · 헤더는 명사 · 명사구로 쓴다 (끝에 ~다 · ~요 · ~까 · ~나 · ~가 · ~기 · ? 금지). `npm run docs` 의 「문장형 제목」 경고가 잡는다. 코드 문자열은 `npm test` 가 검사한다.

## 작업 흐름

1. 고친다 — 정본은 `packs/` · `templates/` · `bin/`. 워크스페이스의 생성물을 흉내 내 여기서 손으로 만들지 않는다.
2. **`npm test`** — 팩 테스트 전부 + 임시 폴더에 워크스페이스 2종(신규 전체 팩 / 차세대) 생성 → `check` → 죽은 참조 → 금지 문자열. 통과해야 커밋한다.
3. 선택 화면(`aidure init`)을 고쳤으면 실제 터미널에서 한 번 끝까지 돌린다. 화면 흐름은 `npm test` 가 보지 않는다.
   문서 사이트 · ERD · 화면설계서 화면(`packs/core/assets/docs-site/` · `packs/datamodel/assets/erd/` · `packs/screens/assets/storyboard/`)을 고쳤으면 `npm run test:site` (Chrome 으로 이동 · 검색 · 필기 · 뷰어를 본다).
4. 에이전트 동작(룰이 먹는지, 스킬이 보이는지)을 바꿨으면 생성된 워크스페이스에서 `aidure start` 로 실제 세션을 한 번 확인한다.
   Claude 는 `aidure start --claude -- -p "…"` 로 비대화형 확인이 된다.
5. **문서 = md 원본 + 문서 사이트 HTML.** 사용법·화면·명령이 바뀌면 같은 커밋에서 아래를 모두 고친다. "가이드 문서" 는 사이트(`docs-site/`, GitLab Pages)까지 뜻한다.
   - 원본: `README.md` · `docs/*.md` · 팩 설명과 변수 설명(`packs/*/pack.json` → 사이트 "팩 종류" `docs/packs.md`) · `CHANGELOG.md`
   - `npm run docs` 로 `docs-site/` 를 다시 만든다 (`npm test` 는 md 와 HTML 이 어긋난 것만 잡는다. 원본에 남은 옛 설명은 못 잡는다). 문서 점검 경고(⚠)가 나오면 이번에 고친 문서부터 줄인다.
   - 바뀐 기능의 **옛 표현을 `docs-site/` 에서 grep 해 0건 (`grep -r --include=*.html`)**인지, 새 표현이 들어갔는지 확인하고 보고에 한 줄 적는다.
6. 새 `aidure` 명령을 만들면 `packs/core/skills/aidure/SKILL.md` 표에도 넣는다 (채팅에서 말로도 되게). `npm test` 가 `bin/aidure.js` 도움말의 명령이 스킬에 모두 있는지 본다.
7. 선택 화면·명령·저장 위치를 바꾸면 **`docs/workflow.md` 의 흐름도(mermaid)** 를 같은 커밋에서 고친다.
   `npm test` 가 화면의 질문 문구와 `aidure` 명령이 문서에 모두 있는지 본다. 도표를 고쳤으면 렌더도 확인한다(`npx -p @mermaid-js/mermaid-cli mmdc`).

## 모델 목록 관리 — `packs/core/models.json`

- 모델 추천(실행 도구별 × 최고·표준·절약)·선택지·퇴역 목록은 **이 파일만** 고친다. 새 모델·퇴역 공지·"카탈로그 N일 지남" 경고가 오면 **`docs/model-catalog.md` 절차**(공식 출처 조사 → 역할별 판단 → 반영)를 따른다.
- 모델마다 `checked`·`sources`, 벤치마크는 `bench`(출처 필수). 공식 문서·실제 CLI 실행으로 확인한 것만 넣는다. 벤치마크는 독립 측정 LiveBench(`npm run models:livebench`, 브라우저 없이 CSV)를 먼저 본다.
- `docs/team-models.md` · `docs/workflow.md` 의 추천 표는 `npm run models:doc` 이 만든다 — 손으로 고치지 않는다. `npm test` 가 어긋남·없는 ID·퇴역 모델 추천을 잡는다.
- 기본값은 가능하면 **별칭**(Claude `opus`·`sonnet`·`haiku`·`fable`)으로 둔다. 워크스페이스는 `aidure upgrade` 로 받고, sync 가 낡은 모델을 경고하며 `aidure models --migrate` 로 바꾼다.

## 버전·배포

- 공개 npm 패키지 `aidure` 로 배포한다. 이 repo 는 원본에서 사내 전용 파일을 빼고 내보낸 것이다: 고칠 것은 이슈 · PR 로 받아 원본에 반영한 뒤 다시 내보낸다.
- 워크스페이스에 영향이 있는 변경이면 `package.json` 의 `version` 을 올린다 (생성 규칙·`workspace.json` 형식 변경 = minor, 문구 수정 = patch).
  워크스페이스는 `workspace.json` 의 `kit.version` 에 만든 버전을 기록한다.
- 커밋 · push 는 사용자가 요청할 때만 한다. 메시지는 `type: 요약` 한 줄.

## 하지 않는다

- 워크스페이스용 규칙을 이 파일에 쓰지 않는다 — 그건 `packs/` 로 간다. 이 파일은 **킷을 고치는 사람**을 위한 것이다.
- `templates/docs-repo/` 에 `{{ws:…}}` 를 쓰지 않는다 (렌더되지 않는다).
- `node_modules/` · 임시 워크스페이스를 커밋하지 않는다.
