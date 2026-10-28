# 명령

아래 명령은 모두 `aidure start` 로 띄운 AI 채팅에서 말로도 된다 ("스프린트로 바꿔줘" · "FN-001 어디서 써?" · "리뷰는 GPT 로"). core 의 `aidure` 스킬이 말을 명령으로 바꿔 실행하고, 팀 범위 설정은 실행 전에 무엇이 바뀌는지 보여 주고 확인받는다. 채팅 안에서 하지 않는 것은 `aidure start`(에이전트 안에서 또 띄움) · `aidure init` · `aidure remove`(선택 화면 · 삭제) · `aidure notify setup`(터미널 화면) 뿐이고, 그때는 AI 가 명령을 알려 준다.

`aidure --help` 는 자주 쓰는 명령과 분류 8개(시작 · 설치 · AI · 모델 · 프로젝트 설정 · 팀 · 팀 규칙 점검 · 진행 · 기록 · 문서 · 알림 · 연동)만 보인다. 터미널에서는 분류를 골라 그 명령들을 보고, `aidure help <번호>` 는 그 분류만, `aidure help --all` 은 전체다. 명령마다 `--help` · `-h` 를 붙이면 그 명령의 사용법만 보이고 실행하지 않는다 (`aidure upgrade --help`). `upgrade` · `reset` · `install` 은 모르는 옵션이 있으면 실행하지 않는다.

| 명령 | 언제 | 하는 일 |
|---|---|---|
| `aidure init [프로젝트명]` | 프로젝트당 1번 (리드) | 선택 화면으로 워크스페이스 생성 → 이어서 install. clone 한 repo 안이면 그 자리에, 아니면 `./<이름>` 에 만든다 |
| `aidure install` | clone 직후 1번 (팀원) | ① `workspace.json` 의 repo 를 `repos/` 에 clone (repo 마다 `(3/15)` 순번 · 받은 양 · 속도 · 걸린 시간 한 줄. 받는 속도가 60초 동안 1KB/s 아래면 끊고 ✖) ② git 훅 등록 ③ 두 도구용 파일 생성 ④ AI 연결 방식 · 실행 인자 (처음 한 번. 모델 프로필은 팀 값을 따른다) |
| `aidure start [--no-brief] [--no-channel] [--pixel-agents]` | 매번 | 이 워크스페이스에 정한 에이전트(claude/codex)를 실행. 세션 시작 훅이 브리핑(프로젝트 · 로드맵(흐름도 · 지금 단계 표) · 공지 `NOTICE.md` · 마지막 핸드오프 · 미완 작업(진행 중 작업의 완료 조건) · 내 TODO)을 넘기고, 첫 메시지 "세션 브리핑" 한 줄에 에이전트가 표로 보여 준다. 워크스페이스 안 어느 폴더에서든, 또는 바로 위 폴더에서. `--pixel-agents`: 설치된 [Pixel Agents](https://github.com/pablodelucca/pixel-agents)(`npm i -g pixel-agents`)로 에이전트 · 팀원을 캐릭터로 보여 주는 화면을 브라우저로 연다. 세션이 끝나면 함께 끈다. 없으면 알리고 화면 없이 시작 |
| `aidure start --codex` | 가끔 | 이번 한 번만 다른 에이전트로. `-- <인자>` 로 에이전트 인자 전달 |
| `aidure start -c` · `-r <세션 ID>` · `-r` | `/exit` 뒤 이어서 할 때 | 지난 대화 이어서: `-c` 마지막 대화 · `-r <ID>` 그 세션(`/exit` 때 나온 ID) · `-r` 목록에서 고르기. 브리핑 없이, 모델 · 텔레그램 채널은 그대로. Claude `--continue` · `--resume`, Codex `resume --last` · `resume <ID>` 로 바꿔 넘긴다 |
| `aidure agent` | 필요할 때 | AI 연결 방식·항상 붙일 인자를 다시 고른다 (시작 도구는 연결 방식으로 정해진다) |
| `aidure ai` · `ai show` | 구독·게이트웨이가 바뀌었을 때 | 쓰는 AI(Claude · GPT · 둘 다 · AI 게이트웨이)만 다시 고른다 / 지금 값 보기 |
| `aidure ai direct claude,gpt` · `gateway [--url <주소> --key-env <변수>]` · `refresh` · `compose mix\|vendor\|single` · `main claude\|gpt` | AI 에게 시킬 때 | 화면 없이 같은 일. `refresh` 는 게이트웨이 모델 목록을 다시 받는다. `--key-env` 를 빼면 이 PC 설정에서 같은 주소의 키 이름(`ANTHROPIC_AUTH_TOKEN` 등)을 찾아 쓴다. `--team` 이면 팀 기본값 |
| `aidure models` | 필요할 때 | 모델 프로필, 또는 역할별(한 번에 차례로·하나씩)·교차 검토 모델을 **팀 기본값** 또는 **이 PC 만** 바꾼다. 화면 없이 실행하면 표(팀 구성 · 역할별 등급과 출처), `--json` 은 JSON |
| `aidure approach [sprint\|full\|issue]` | 진행 방식을 바꿀 때 | MVP · 스프린트(기능 단위. 끝까지 동작하는 최소 기능부터, 스프린트마다 데모 · 회고하고 백로그에서 하나씩) · 워터폴 · 전체(전체 설계 뒤 구축) · 이슈형(운영 · 유지보수: 이슈마다 운영 반영, 단계 대신 이슈 보드). 인자 없이 = 지금 값. 기본 단계 그대로인 로드맵은 새 뼈대로 바꾸고, 이슈형으로 바꾸면 고친 로드맵에도 맨 앞에 이슈 보드를 끼운다 (전 단계 표는 아래에 남김) (관리자) |
| `aidure type [유형] [--approach a] [--code 이름,…]` | 분석·설계를 끝내고 구축 · 고도화로 넘어갈 때 | 같은 워크스페이스에서 유형을 바꾼다: 고칠 repo (현행 → 개발 repo, 화면에서 고름) · 진행 방식 · 유형 팩 교체 · 로드맵 새 뼈대(지난 로드맵은 아래 「지난 로드맵」 절에 남김) → sync. 기획 · 이슈 repo 와 작업 기록은 그대로 이어진다. 인자 없이 = 지금 값 (관리자) |
| `aidure team-mode [auto\|fixed]` · `prefer <역할> <claude\|codex>:<모델>` `[--team]` | 팀 구성 방식을 바꿀 때 | 자동(리더가 작업마다 역할·모델) · 고정(프로필대로), 역할별 선호 모델. `--team` 은 팀 기본값(관리자), 없으면 이 PC 만 |
| `aidure team-mode enforce review off\|warn\|block` `[--repos a,b\|*] [--min-lines N] [--paths p1,p2] --team` · `aidure review status` · `mark` · `skip --reason "<사유>"` | 리뷰 없이 commit · push 하는 것을 잡을 때 | 기본 꺼짐. 켜면 에이전트(Claude Code)가 코드 · 기획 repo 에서 `git commit` · `git push` 할 때 리뷰 기록과 비교해 리뷰 안 된 줄 수가 기준을 넘으면 알리거나(warn) 막는다(block). 리뷰 기록은 reviewer 역할 에이전트 · reviewer 위임 · 교차 검토 때 남고, 리뷰 뒤 고치면 고친 만큼만 다시 센다. `mark` 는 직접 기록, `skip` 은 사용자 승인 뒤 한 번 생략. 핸드오프 기록은 세지 않는다 |
| `aidure tidy` `[--new] [--repo <이름>] [--count] [--json]` | 방향을 바꾸거나 고친 뒤 남은 파일을 찾을 때 | 읽기만 하는 보고서: 이번 작업 새 파일(커밋 안 한 것 · push 안 한 커밋), 어느 글에도 이름이 없는 이미지 · 동영상 · PDF, 링크 없는 문서, 백업 이름(`_old` · `.bak` · 번호 사본). 코드는 프로젝트 도구(knip · vulture · detekt 등)를 알려 준다. 지우기는 채팅에서 "안 쓰는 파일 정리해줘" (`tidy` 스킬: 표 → 승인 → 지움 → 검증) |
| `aidure import <폴더>` `[--json]` | 예전 AI 작업 폴더(지침 파일 · 룰 · 메모 · 핸드오프 · 스크립트)를 워크스페이스로 옮길 때 | 읽기만 하는 보고서: 종류별 분류, 큰 폴더(산출물 후보), 문서 속 개인 폴더 절대경로, 비밀값 의심 줄(값은 찍지 않는다). 옮기기는 채팅에서 "기존 폴더 가져와" (`import` 스킬: 계획 → 승인 → 반영) |
| `aidure prefs` · `language ko\|en\|team` · `style learn\|normal\|expert\|team` `[--team]` · `mermaid [install]` · `setup` | AI 의 답하는 언어 · 설명 정도를 바꿀 때 | 응답 언어(한국어 · English)는 진행 알림 · 중간 설명까지 그 언어로 (Claude Code 는 요청마다, 긴 작업 중에는 도구 15번 · 4분마다 다시 한 줄을 넣는다). 대화 스타일은 학습(단계마다 왜 · 어떻게, 용어 풀이) · 일반(지금 수준) · 전문가(부가 설명 없이 현업 용어 · 결과 · 근거 표와 그림). 이 PC 값이 팀 값보다 먼저, `team` 은 이 PC 값을 지운다. `--team` 은 팀 기본값(관리자). `mermaid install` 은 그림을 브라우저로 띄우는 claude-mermaid 플러그인 설치 (없으면 텍스트 그림). 인자 없이 = 지금 값 |
| `aidure timestamp [on\|off\|team]` `[--team]` | 답변 첫 줄 시각 표시를 끄거나 켤 때 | 켜짐(기본)이면 Claude Code 답변 첫 줄에 요청 받은 시각(yyyy-MM-dd HH:mm:ss)이 나온다. 작업 시작 시각이고 끝 시각은 아니다. 이 PC 값이 팀 값보다 먼저, `team` 은 이 PC 값을 지운다. `--team` 은 팀 기본값(관리자) |
| `aidure team-mode enforce run off\|warn\|block` `[--after 분] [--team]` | 팀원 · 위임이 오래 돌 때 | 일하는 팀원(Claude Code 팀 모드) · 위임 작업의 경과가 상한(기본 60분, 팀 값)을 넘으면 멈출 때 한 번 막고 계속할지 사용자에게 묻게 한다(기본). 같은 대상은 상한만큼 지나 다시 |
| `aidure team-mode enforce plan off\|warn\|block` `[--team]` | 코드를 고치기 전에 계획을 보였는지 | 요청마다 코드 repo 첫 수정 전에 답변에 `착수 전 확인:` 머리말이 없으면 알린다(기본: 요청마다 한 번). 막기면 보일 때까지 수정을 막는다. 문서 · 스타일 두 줄 이하는 제외 |
| `aidure team-mode enforce check off\|warn\|block` `[--team]` | 리뷰 전에 검사를 돌렸는지 | 리뷰 위임 · 리뷰 에이전트 지시서에 `검사: <명령> 통과` 줄이 없으면 막는다(기본). 순서: 구현 → 해당 검사 → 리뷰 → 수정 → 해당 검사. 검사가 없는 변경은 `검사: 없음 (사유)` |
| `aidure team-mode enforce ask off\|block` `[--team]` | 에이전트가 결정을 선택지 창 없이 글로 물을 때 | Claude Code 에서 번호 선택지 2개 이상인 결정 질문을 질문 창 없이 끝내면 훅이 한 번 막고 질문 창으로 다시 묻게 한다(기본). 자리 비움(텔레그램 결정) 세션은 제외 |
| `aidure team-mode enforce status off\|block` `[--team]` | 에이전트가 기다리며 멈췄는데 사용자가 일하는 중으로 알고 기다리는 것을 막을 때 | Claude Code 에서 팀원(일하는 중 · 대기)이나 리더의 백그라운드 작업이 남은 채 멈추는데 답변에 `지금 도는 것: … · 예상 종료: … · 사용자가 할 일: …` 줄이 없으면 훅이 한 번 막는다(기본). 끝남 알림(텔레그램)에도 일하는 팀원 · 대기 팀원 · 백그라운드 작업 수가 한 줄 붙는다 |
| `aidure team-mode enforce idle off\|warn\|block` `[--after <분>] [--remind <분>] [--team]` | 일을 마친 팀원이 대기로 오래 남는 것을 잡을 때 | Claude Code agent teams 에서 대기 10분을 넘긴 팀원이 있으면 리더가 멈출 때 훅이 한 번 막고 이름과 대기 시간을 알린다(기본). 리더는 종료하거나 보고에 대기 사유를 적는다. 같은 팀원은 30분 뒤에 다시 알린다. `warn` 은 요청 시작 때 한 줄만, `off` 는 끈다. 훅은 팀원을 종료하지 않는다. 시간(`--after` · `--remind`)은 팀 값 |
| `aidure team-mode enforce name off\|warn\|block` · `roster off\|warn` `[--team]` | 역할 에이전트 규칙을 훅으로 지키게 할 때 | `name`: Claude Code agent teams 가 켜진 PC 에서 역할 에이전트를 이름(`name`) 없이 띄우면 훅이 막는다(기본) · 경고만 · 끈다. `roster`: 한 요청의 첫 역할 에이전트 때 실행 방식 · 구성표를 알렸는지 한 줄을 넣는다(기본, 막지 않는다) · 끈다. 이 PC 값은 팀 값보다 세게만 |
| `aidure ai plan claude\|gpt <요금제>` `[--team]` | 요금제를 바꿨을 때 | 회사별 요금제(여유도 빠듯 · 넉넉 · 종량). 보통은 `aidure ai` 화면에서 고르고, 이 PC 로그인 정보의 요금제가 미리 골라져 있다 |
| `aidure models profile <이름> [--team]` · `models set <역할> <도구> <모델> [--team]` · `models allow-higher on\|off` · `aidure agent --claude\|--codex` | AI 에게 시킬 때 | 화면 없이 같은 일을 한다. AI 콘솔에서 "리뷰는 GPT 로 바꿔줘" 처럼 말하면 `aidure` 스킬이 이 명령을 쓴다 |
| `aidure team edit allow\|deny` · `admins [id…]` | 팀장이 설정 수정 권한을 정할 때 | 불가면 관리자만 `workspace.json` · 팩을 바꾸고, 팀원은 자기 핸드오프와 로드맵(`handoffs/PLAN.md`)만 커밋한다 |
| `aidure team add\|remove <id…>` · `members` · `restrict on\|off` | 리더가 팀 명단을 관리할 때 | `workspace.json` 의 `team` 에 명단을 둔다 (id = 그 사람 워크스페이스의 `git user.name`). `restrict on` 이면 명단 밖 사람은 `aidure start` 가 멈춘다 |
| `aidure team [id] [--take 번호…\|all]` | 팀 상황을 볼 때 · 인수할 때 | 모두의 핸드오프를 모아 누가 언제 무엇을 얼마나 했는지 (원격 기준, 읽기만). id 를 주면 그 사람 자세히, `--take` 면 그 사람 TODO 항목을 내 TODO 로 인수 |
| `aidure notify setup` | 텔레그램 알림을 켜고 바꿀 때 | 설정 화면 하나에서 알림 수준 · 양방향 대화 · 자리 비움 · 개인 봇 · 팀 방 · 고급 · 시험 발송을 고른다. 이미 한 것은 바꾸기 · 제거 |
| `aidure reset` | 이 PC 설정을 처음 상태로 되돌릴 때 | 이 PC 설정(`.agents/local.json`) · 텔레그램 채널 · 세션 임시 기록 · 개인 지침 · 텔레그램 토큰 중 골라서 지운다. 팀 설정 · repos · 핸드오프는 그대로. 워크스페이스를 통째로 지우는 것은 `aidure remove` |
| `aidure notify` · `notify my …` · `notify team …` | 화면 없이 (AI 에게 시킬 때) | 알림 상태 · 개인 봇 연결과 켜고 끄기 · 팀 봇 연결과 팀 방 지정 · 공지 ([알림](notify.md)) |
| `aidure handoff find <티켓·기능>` · `check` · `index` · `archive` · `organize` | 지난 기록을 찾을 때 · 기록이 커졌을 때 | 모든 사람의 핸드오프 기록에서 파일:줄로 찾기 · 크기 검사 · 색인 · 보관 · 정리 후보 |
| `aidure plan` · `--short` · `--json` · `--report [시작 [끝]]` · `init` · `check` | 진행 정도를 볼 때 · 단계를 끝냈을 때 · 주간 보고 | 로드맵(`handoffs/PLAN.md`): 단계 흐름 · 지금 단계 표 · 이번에 생긴 것(커밋 · 새 파일 · ID) · 다음. 이슈형은 이슈 보드: 상태별 건수 · 진행 중 이슈 표 · 멈춘 이슈 ⚠ · 개선 후보. `--report` 는 이슈형 기간 보고(기본 오늘까지 7일: 운영 반영 · 진행 중 · 새 접수 · 보류 · 멈춘 이슈). `--json` 은 다른 도구(전광판 등)용, `check` 는 갱신 누락 경고 |
| `aidure docs build [repo]` · `check` | 기획 문서 · 화면설계서 · 테이블 정의서를 고쳤을 때 | 기획 repo 의 md · 화면설계서 장 → `docs-site/` (정의 ID 앵커 · 근거 색인 `ids.json` · 뷰어 파일 · 정의서 폴더마다 ERD `erd.html`). `check` 는 md 와 `docs-site/` 가 어긋났는지 (기획 repo 의 pre-commit 도 막는다). 둘 다 문서 점검 경고(큰 문서 · 머리말 이력 · 같은 문장 · 긴 표 칸 · 문단형 표 · 칸 안 경위 · 그림 없는 큰 문서 · 메뉴 「기타」)를 낸다 |
| `aidure delegate watch [id]` · `status [id]` · `list` | 다른 도구에 맡긴 리뷰 · 작업(Claude Code ↔ Codex)이 지금 무엇을 하는지 볼 때 | `watch` = 상대 에이전트가 읽은 파일 · 찾기 · 실행한 명령 · 고친 파일 · 중간에 한 말을 생기는 대로 한 줄씩(다른 터미널에서), 끝나면 요약. `status` = 경과 · 개수 · 최근 동작을 한 번. id 를 빼면 마지막 실행 중 작업 |
| `aidure docs serve [repo]` | Pages 없이 이 PC 에서 문서 사이트를 볼 때 | `docs-site/` 를 `http://127.0.0.1:8000/` 로 연다 (`--port` · `--open`). `file://` 로 열면 쪽 이동이 새로고침이 되고 전체 인쇄가 안 된다 |
| `aidure docs pages [on\|off] [repo]` | 문서 사이트를 Pages 로 올릴지 정할 때 | on = 원격에 맞는 CI 파일 · `docs-site/` 커밋 대상, off = `.gitignore` 에 `/docs-site/`. 인자 없이 = repo 마다 상태 |
| `aidure docs show <ID>` · `refs <ID>` | 근거를 볼 때 · 결정이 바뀌어 고칠 곳을 찾을 때 | `show` = 그 ID 의 정의 부분만(제목 절 · 표 행 · 문단 · 화면설계서 장). `refs` = 그 ID 가 나오는 곳(기획 · 코드 · 이슈 repo, 파일:줄, ★ 정의 · [동결]). 에이전트도 큰 문서를 통째로 열지 않고 이것을 쓴다 |
| `aidure docs refs-quote <파일…>` | 문서 점검의 「파일:줄 참조」 경고가 많을 때 | 본문 괄호 속 근거(파일:줄)를 그 문단 · 목록 · 표 아래 「> 근거:」 인용구로 옮긴다. `--dry` 는 옮길 곳 수만 |
| `aidure docs trace` `[--md] [--new]` | 기획대로 만들었는지 볼 때 | 기획 ID(`vars.docs.traceIds`, 예: FN,SCR,API,AC)와 코드의 `@spec` 주석을 대조. ⚠ 코드에 표시 없는 ID · ⚠ 테스트에 없는 수용 기준(AC-) · ✖ 기획에 정의 없는 ID(오타 · 지운 기능), 각각 파일:줄. `--md` = 추적표(ID · 정의 · 코드 · 테스트), `--new` = 새로 만들거나 고친 진입 파일(컨트롤러 · 화면 · 라우트 등) 중 기획 ID 가 없는 것 (커밋 전) |
| `aidure gitlab pipeline` | MR · 배포 뒤 파이프라인을 볼 때 | 최근 파이프라인 목록과 맨 위(또는 `--id`) 파이프라인의 단계별 작업 상태. `--ref <브랜치>` · `--mr <번호>`(MR 파이프라인이 없으면 머지 커밋의 것) · `--log`(실패한 작업의 로그 끝부분) · `--json`. 읽기만 한다 (gitlab 팩, `GITLAB_TOKEN`) |
| `aidure board` | 팀 · 프로젝트 현황을 한눈에 볼 때 | 워크스페이스 현황판(로드맵 · 팀원별 마지막 핸드오프 · 미완 작업 · 공지)과 기록 쪽을 이 PC 의 `.agents/board/` 에 만들어 연다. 보기 전용 |
| `aidure screens check [repo]` | 화면설계서를 쓴 뒤 | 근거 ID 가 색인에 있는지 · 화면 ID 중복 · Description 줄이 결론 한 줄인지(60자 넘음 · 날짜 · 결정 경위는 ⚠) · 기능 ID 누락(`vars.screens.functionIds`, 화면 목록의 「화면 없음」 행은 뺀다) · 화면 목록과 장 대조 (이어지는 장 `data-continues` 는 뺀다) |
| `aidure datamodel check [repo]` | 테이블 정의서를 쓴 뒤 | ✖ 참조 대상 없음 · 기본키 없음 · 테이블 · 컬럼 중복 · 표 형식. ⚠ 논리명 없음 · 컨벤션 위반(`vars.datamodel`) · 기능 ID 없는 테이블 · 테이블 없는 기능(「없음」 으로 적은 것은 뺀다) |
| `aidure rules [list \| off <ID> \| on <ID>]` `[--repo <이름,…>]` | 규칙이 팀에 맞지 않을 때 | 킷이 넣은 규칙을 켜고 끈다 (필수 규칙 제외). `--repo` 는 스택 · 언어 규칙을 그 repo 에서만. 바꾸기는 `packs/project/rules` 에 `replaces` (`repos:` 를 더하면 그 repo 만) |
| `aidure rules ondemand\|always <ID…\|repo-tasks>` | AGENTS.md 가 Codex 한도를 넘을 때 | 상시 규칙을 필요할 때만 읽게 한다 (`rules.onDemand`). `repo-tasks` 는 「repo 별 작업 규칙」의 작업별 표를 `.agents/rules/repo-tasks.md` 로 뺀다. sync 경고가 큰 절을 알려 준다 |
| `aidure repo add [주소·폴더·이름]` | repo 를 더할 때 | clone · 링크(원격 없는 로컬 repo 도), 또는 이름만 주면 `repos/<이름>` 에 원격 없이 새로 만든다. 인자 없이 = 화면에서 방식(clone · 기존 로컬 폴더 · 새로 만들기)을 먼저 고른다 (레거시 제외. 기획 repo 면 뼈대는 `aidure init-docs`) → 스택 확인 → sync |
| `aidure repo add … --group <그룹>` | repo 가 많아 폴더를 나눌 때 | `repos/<그룹>/<이름>` 에 받는다. 이미 그룹을 쓰는 워크스페이스면 화면에서 고른다 ([그룹 폴더](workspace.md#repo-그룹-폴더)) |
| `aidure repo move <이름> --group <그룹>` · `--no-group` | 있는 repo 를 그룹 폴더로 옮길 때 | 폴더 · `workspace.json` · 사람이 쓴 md 의 옛 경로를 고치고 sync (관리자) |
| `aidure repo guides` · `<이름> follow\|kit\|ignore` · `--rescan [<이름>]` | 받은 repo 에 원래 CLAUDE.md · AGENTS.md · 룰 · 스킬이 있을 때 | 목록과 따르는 방식을 보여 주고 바꾼다. follow = repo 지침 우선(기본), kit = 킷 규칙 우선, ignore = 무시. 자세히는 [repo 자체 지침](workspace.md#repo-자체-지침) (관리자) |
| `aidure repo remove <이름> [--delete]` | repo 를 뺄 때 | `workspace.json` · 리뷰 대상에서 지우고 sync, 이름이 남은 문서(README 등)를 알린다. 폴더는 `--delete` 일 때만 지운다 (커밋 안 한 변경 · push 안 한 커밋이 있으면 거부) |
| `aidure detect` | repo 스택이 바뀌었을 때 | 코드 repo 의 기술 스택을 다시 감지하고 고친다 → repo 별 규칙이 바뀐다 |
| `aidure detect --hint <스택> --contains <정규식>` | 사내 라이브러리를 거쳐 쓰는 프레임워크가 감지되지 않을 때 | 감지 힌트를 `workspace.json` 의 `stackHints` 에 더하고 다시 감지한다 |
| `aidure list` | 워크스페이스를 찾을 때 | 이 PC 의 워크스페이스 이름·킷 버전·경로. init 으로 만들거나 그 폴더에서 `aidure` 명령을 한 번 쓰면 오른다 (`~/.aidure/workspaces.json`, 지운 폴더는 자동으로 빠진다) |
| `aidure help [번호\|명령\|--all]` | 명령을 찾을 때 | 인자 없이 = 자주 쓰는 명령과 분류 목록 (터미널이면 분류를 골라 보기). 번호 = 그 분류의 명령, 명령 이름 = 그 명령의 사용법, `--all` = 전체 |
| `aidure remove [이름] [--force]` | 다시 만들 때 | 이름을 주면 `aidure list` 에서 찾아 어디서든, 없으면 지금 폴더의 워크스페이스를 비운다 (`repos/` 포함, `.git`·README·LICENSE 는 남기고 `.gitignore` 는 킷이 넣은 줄만 걷어 내 그 자리에서 다시 init 할 수 있다). 커밋·push 안 한 작업이 있으면 멈추고, 예/아니오 확인 뒤 실행된다. 워크스페이스가 아닌 곳에서 이름 없이 실행하면 안내만 한다. |
| `aidure init-docs [폴더]` | 기획 repo 가 없을 때 | 기획자 repo 뼈대 생성 (읽는 순서대로: 개요 · 아이디어 → 시스템 구성(아키텍처 양식) → 기능(요구 목록 · 영역별 기능 문서 · 업무 규칙) → 화면(목록 · 정책 · 프로토타입) → 데이터 · API → 결정 · 미결, 메뉴 `docs-site.json`)  기획 repo 를 두지 않는 프로젝트는 `workspace.json` 에 `"docsRepo": false` 를 넣으면 sync 의 "기획 repo 가 없습니다" 경고가 꺼진다 (운영·고도화 유형은 처음부터 경고하지 않는다) |
| `aidure sync` · `check` · `doctor` · `packs` | 필요할 때 | 생성 · 생성물 검사 · 환경 진단 · 팩 목록 |
| `aidure upgrade [--add 팩]` | 킷 새 버전 후 | 워크스페이스의 `bin/kit.js` 와 팩을 이 킷 버전으로 (project 팩은 그대로). 몇 버전 뒤져도 한 번에 올라가고 그 사이 변경 기록을 모두 보여 준다. 저절로 켜지 않는 것은 한 줄씩 알린다: 그 유형의 기본 팩인데 꺼진 팩(`--add` 로 켬) · 진행 방식 · 새로 감지되는 스택 |
| `aidure upgrade --all` `[--scan <폴더>] [--yes]` | `npm i -g` 로 새 버전을 받은 뒤 이 PC 의 워크스페이스를 모두 올릴 때 | `aidure list` 의 워크스페이스(`--scan` 이면 그 폴더 아래에서 찾아 더함)를 버전과 함께 보이고, 옛 버전만 묻고 올린다. 관리자 아님 · 원격에 받지 않은 커밋(팀원이 먼저 올렸을 수 있음) · 커밋 안 한 변경이 있으면 건너뛴다. 끝나면 워크스페이스마다 commit · push 명령을 보여 준다. 새 버전을 받은 뒤 첫 aidure 명령이 옛 버전 워크스페이스 수를 한 번 알린다 |

AI 연결 방식과 시작 도구는 **워크스페이스마다** 정하고 `.agents/local.json` 에 저장한다 (이 PC 전용, git 공유 안 함). 구독·게이트웨이는 사람마다 다르기 때문이다.

## `aidure init` 화면

```screen
◇ 프로젝트명           영문 소문자와 - 만, 문자로 시작 (예: new-stocker). 지금 폴더 아래 <이름>/ 을 만든다
◇ 시작 유형            ● 신규 구축 ○ 차세대 ○ 운영·고도화(SM 포함) ○ 분석·설계(ISP·ISMP)
   고르는 유형의 근거 · 넣는 repo · AI 가 하는 일이 목록 아래에 보인다
◇ 프로젝트 repository   하나 입력 → [추가] [확정] 반복 (분석·설계는 묻지 않음)
◇ 기획 repository       〃 (없으면 Enter)
◇ 이슈 repository       〃 (없으면 Enter)
◇ 레거시·현행 repository  차세대(필수) · 분석·설계(선택)만
◇ <호스트> 의 협업 도구  github.com·gitlab 이 든 주소는 자동 판단, 모르는 호스트만 묻는다
◇ 이대로 만들까요?
   … 워크스페이스 생성 · repo clone · 스택 감지 …
◇ repos/<이름> 스택     감지 결과 [맞음] [고치기] [건너뛰기]  (repo 마다)
   고치기 → 서버/클라이언트 → (클라이언트면) 웹·데스크톱·모바일·워치·TV → 프레임워크 → 세부(예: Spring MVC·WebFlux·Batch…) → DB
   모르는 단계는 Enter 로 건너뛴다
◇ 쓰는 AI              ○ Claude 만  ○ GPT 만  ● Claude + GPT  ○ AI 게이트웨이
   게이트웨이 → 찾은 주소 확인(또는 주소 · 키 환경변수 이름) → 모델 목록 조회 → 메인 모델 Claude · GPT
   역할 구성은 자동 (두 회사 = 섞기, 한 회사 = 한 회사 모델만). 단일 모델은 aidure ai compose single
◇ 팀 기본 모델 프로필   최고 · 표준 · 절약 · 역할별로 직접 고르기
◇ claude 에 항상 붙일 인자   없음 · 계획 먼저 · 파일 수정은 자동 · 확인 없이 실행 · 직접 입력 (이 PC 전용)
◇ 워크스페이스 repository 주소 → 지금 커밋·push 할까요?   (원격이 없으면 주소부터, 예를 누르면 push 까지)
```

**Esc 는 이전 질문으로**(첫 질문에서는 취소), Ctrl+C 는 전체 취소. 폴더는 마지막 "이대로 만들까요?" 에서 예를 누른 뒤에만 만든다.
프로젝트 폴더를 미리 만들 필요 없이 **상위 폴더에서** `aidure init` 한다 (그 이름의 빈 폴더 안에서 해도 겹쳐 만들지 않는다). 안에 파일이 있는 폴더·이미 워크스페이스인 곳은 막는다.
repo 이름은 주소 끝 폴더명에서 자동으로 정한다. 스택·역할·브랜치는 `workspace.json` 에서 고치고 `aidure sync`.
스크립트로 만들 때는 `node <킷>/bin/kit.js init <폴더> --type new|modernization --packs … --docs … --legacy …`.
