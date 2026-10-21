---
name: aidure
description: 워크스페이스 설정을 바꾸거나 확인하는 요청을 aidure 명령으로 처리한다 (비밀값(토큰) 확인 · 옮기기 · 텔레그램 알림 · 팀 공지 · 모델·프로필·AI 연결 방식(구독·게이트웨이)·시작 도구·규칙 켜고 끄기·팀 명단·설정 수정 권한·repo 추가·스택 감지·진단·팀 현황·킷 업그레이드 · 팩 켜기 · 진행 방식(스프린트 · 전체 · 이슈형) · 유형 바꾸기 · 로드맵 보기 · 문서 사이트 · 기획 문서 ID 찾기 · 화면설계 · 데이터 설계 검사). "모델 바꿔줘", "리뷰는 GPT 로", "이제 Claude 만 써", "게이트웨이 모델 다시 받아", "이 규칙 꺼줘", "repo 추가해줘", "팀원 추가", "설정 잠가줘", "킷 업데이트", "텔레그램 알림 켜줘", "팀 방에 공지해줘", "스프린트로 바꿔줘", "로드맵 보여줘", "FN-001 어디서 써?", "GitLab 토큰 확인해줘", "토큰 옮겨줘" 같은 요청에 쓴다.
---

# aidure: 워크스페이스 설정을 명령으로

워크스페이스 설정은 파일을 직접 고치지 않고 **aidure 명령**으로 바꾼다 (생성물이 함께 맞춰진다). 명령은 모두 화면 없이 도는 형태로 쓴다.

`aidure` 이 없다고 나오면(에이전트 셸의 PATH 에 없을 때) 워크스페이스 루트의 `.agents/bin/aidure` 을 같은 인자로 실행한다 (이 PC 의 aidure 을 가리킨다). 그것도 없으면 사용자에게 터미널에서 `aidure` 명령을 한 번 실행해 달라고 한다.

## 1. 요청 → 명령

| 요청 | 명령 | 범위 |
|---|---|---|
| 지금 모델 보기 | `aidure models` (화면 없이 실행하면 표: 팀 구성 · 성향 · 역할별 등급과 출처, `--json` 은 JSON) | 보기 |
| 진행 방식 보기 · 바꾸기 | `aidure approach` (지금 값) · `aidure approach sprint\|full\|issue` (스프린트: 최소 기능부터 기능 단위 스프린트 · 데모 · 회고, 전체: 전체 설계 뒤 구축, 이슈형: 운영 · 유지보수의 이슈 보드). 기본 단계 그대로인 로드맵은 새 뼈대로 바뀐다. "작게 시작하자" · "스프린트로" · "이슈 단위로 관리" 같은 말에 쓴다 | 팀 (관리자) |
| 유형 바꾸기 | `aidure type <new\|modernization\|enhancement\|consulting> [--approach a] [--code 이름,…]` (분석·설계 → 구축 · 고도화 등. 현행 repo 중 고칠 것을 개발 repo 로 · 진행 방식 · 로드맵 새 뼈대, 지난 로드맵은 남김). 바꾸기 전에 무엇이 바뀌는지 보여 주고 확인받는다 | 팀 (관리자) |
| 로드맵 보기 · 점검 | `aidure plan` (흐름도 · 지금 단계 표 · 다음, 이슈형은 이슈 보드) · `aidure plan --short` (한 줄) · `aidure plan check` (갱신 누락 ⚠) · `aidure plan --report [시작 [끝]]` (이슈형 주간 보고) | 보기 |
| 팀 구성 바꾸기 | `aidure team-mode auto\|fixed` · `prefer <역할> <claude\|codex>:<모델>` (`--team` 은 팀 기본값, 관리자) | 이 PC · 팀 |
| 훅 강제 수준 (팀 모드에서 이름 없는 역할 에이전트 · 구성표 알림) | `aidure team-mode enforce name off\|warn\|block [--team]` (기본 막기) · `aidure team-mode enforce roster off\|warn [--team]` (한 요청의 첫 역할 에이전트 때 실행 방식 · 구성표를 알렸는지 한 줄, 기본 알림). 이 PC 값은 팀 값보다 세게만, 낮추려면 관리자가 `--team`. 지금 값은 `aidure team-mode` | 이 PC · 팀 |
| 대기 팀원 점검 (Claude Code 팀 모드에서 일을 마치고 오래 남은 팀원) | `aidure team-mode enforce idle off\|warn\|block [--after <분>] [--remind <분>] [--team]`. 막기(기본): 멈출 때 한 번 막고 팀원 이름 · 대기 시간을 알림 · 알림: 요청 시작 때 한 줄 · 끔. 대기 상한(기본 10분) · 같은 팀원을 다시 알리는 간격(기본 30분)은 팀 값(`--team`, 관리자) | 이 PC · 팀 |
| 상태 줄 점검 (Claude Code. 팀원 · 백그라운드 작업이 남은 채 멈출 때) | `aidure team-mode enforce status off\|block [--team]`. 막기(기본): 답변에 「지금 도는 것: … · 예상 종료: … · 사용자가 할 일: …」 줄이 없으면 멈출 때 한 번 막음 · 끔 | 이 PC · 팀 |
| 결정 질문 점검 (Claude Code. 결정 질문을 글로 끝낼 때) | `aidure team-mode enforce ask off\|block [--team]`. 막기(기본): 번호 선택지 2개 이상인 결정 질문을 질문 창 없이 끝내면 한 번 막고 질문 창으로 다시 묻게 함 · 끔 | 이 PC · 팀 |
| 답변 첫 줄 시각 표시 (Claude Code. "시간 표시 꺼줘" 같은 말) | `aidure timestamp` (지금 값) · `aidure timestamp on\|off [--team]` · `aidure timestamp team` (이 PC 값 지우고 팀 따름). 켜면(기본) 요청 받은 시각(yyyy-MM-dd HH:mm:ss)을 답변 첫 줄에 쓴다 | 이 PC · 팀 |
| 오래 일하는 팀원 · 위임 점검 | `aidure team-mode enforce run off\|warn\|block [--after <분>] [--team]`. 막기(기본): 일하는 팀원(Claude Code 팀 모드) · 위임 작업의 경과가 상한(기본 60분)을 넘으면 멈출 때 한 번 막고 계속할지 묻게 함 · 알림: 요청 시작 때 한 줄 · 끔. 상한은 팀 값(`--team`, 관리자) | 이 PC · 팀 |
| 착수 전 확인 | `aidure team-mode enforce plan off\|warn\|block [--team]`. 알림(기본): 요청마다 코드 repo 첫 수정 전에 답변에 「착수 전 확인:」 이 없으면 한 번 알림, 막기: 보일 때까지 수정을 막음. 문서 · 스타일 두 줄 이하는 제외 | 이 PC · 팀 |
| 리뷰 전 검사 | `aidure team-mode enforce check off\|warn\|block [--team]`. 막기(기본): 리뷰 위임 · 리뷰 에이전트 지시서에 「검사: <명령> 통과」 줄이 없으면 막음 (검사가 없는 변경은 「검사: 없음 (사유)」) | 이 PC · 팀 |
| 기존 AI 작업 폴더 가져오기 | 훑기 `aidure import <폴더> [--json]` (읽기만: 분류 · 절대경로 · 비밀값 의심 줄). 옮기기는 `import` 스킬 절차로 계획을 보여 주고 승인 뒤에 | 읽기 |
| 요금제 바꾸기 | `aidure ai plan claude\|gpt <요금제>` (`--team` 은 팀 기본값). 요금제 이름은 틀리면 목록을 보여 준다 | 이 PC · 팀 |
| 프로필 바꾸기 | `aidure models profile <rich\|standard\|lean\|team> [--team]` (이 PC 값은 팀과 같거나 낮은 것만. `team` = 이 PC 값 지우고 팀 따름. 인자 없이 실행하면 화면에서 고른다) | 이 PC · `--team` 은 팀 |
| 팀원이 팀보다 높은 프로필을 쓰게 | `aidure models allow-higher on\|off` | 팀 (관리자) |
| 퇴역 모델을 대체 모델로 | `aidure models --migrate` (sync 가 퇴역 · 퇴역 예정 경고를 냈을 때. 팀 값이 바뀌면 `workspace.json` commit · push) | 이 PC · 팀 |
| 역할 모델 바꾸기 | `aidure models set <역할> <claude\|codex> <모델\|-> [--team] [--effort <e>]` | 이 PC · 팀 |
| 역할을 상대 회사 모델로 | `aidure models set reviewer claude codex:gpt-6.1-sol` (Claude 세션의 리뷰를 GPT 에게 위임) | 이 PC · 팀 |
| 연결 방식 보기 | `aidure ai show` (연결 · 쓰는 AI · 구성 · 게이트웨이 · 역할 모델 · 상한 경고) | 보기 |
| 쓰는 AI 바꾸기 (구독) | `aidure ai direct <claude\|gpt\|claude,gpt>` | 이 PC |
| 게이트웨이 쓰기 · 모델 목록 다시 받기 | `aidure ai gateway [--url <주소> --key-env <키가 든 환경변수 이름>]` · `aidure ai refresh` | 이 PC |
| 역할 구성 | `aidure ai compose mix\|vendor\|single` (섞기 · 한 회사만 · 단일 모델) | 이 PC |
| 게이트웨이에서 메인 모델 회사 | `aidure ai main claude\|gpt` | 이 PC |
| 역할 에이전트 상한 | `.agents/local.json` 의 `agents.limits` `{ "parallel": 2, "total": 5 }` 를 고치고 `node bin/kit.js sync` (팀은 `workspace.json`). 이 PC 값은 팀 값보다 낮게만 | 이 PC · 팀 |
| 지난 대화 이어서 시작 | `aidure start -c`(마지막 대화) · `aidure start -r <세션 ID>` · `aidure start -r`(목록). 세션 안에서는 할 수 없으니 사용자에게 명령을 알려 준다 | 이 PC |
| 에이전트 · 팀원을 캐릭터 화면으로 보기 | `aidure start --pixel-agents`. 이 PC 에 `pixel-agents`(`npm i -g pixel-agents`)가 있어야 한다. 브라우저로 열고 세션이 끝나면 끈다. 세션 안에서는 할 수 없으니 사용자에게 명령을 알려 준다 | 이 PC |
| 시작 도구 바꾸기 | `aidure agent --claude\|--codex [--args "<인자>"]` | 이 PC |
| 규칙 목록 · 끄기 · 켜기 | `aidure rules list` · `aidure rules off <ID…>` · `aidure rules on <ID…>` | 팀 |
| AGENTS.md 줄이기 (상시 규칙을 필요할 때만) | `aidure rules ondemand <ID…\|repo-tasks>` · 되돌리기 `aidure rules always <ID…>` | 팀 |
| 팀 현황 · 한 사람 · 인수 | `aidure team` · `aidure team <id>` · `aidure team <id> --take <번호\|all>` | 보기 · 내 TODO |
| 팀 명단 · 제한 | `aidure team add\|remove <id…>` · `aidure team members` · `aidure team restrict on\|off` | 팀 |
| 설정 수정 권한 | `aidure team edit allow\|deny` · `aidure team admins [id…]` | 팀 |
| repo 추가 | `aidure repo add <git 주소\|폴더\|새 이름> [--kind code\|docs\|issues\|legacy] [--group <그룹>]` (그룹이면 `repos/<그룹>/<이름>`. 이름만 주면 원격 없이 새로 만든다, 레거시 제외) | 팀 |
| repo 그룹 폴더로 옮기기 | `aidure repo move <이름> --group <그룹>` · `--no-group` (폴더 · workspace.json · 문서의 옛 경로를 고치고 sync) | 팀 (관리자) |
| repo 빼기 | `aidure repo remove <이름> [--delete]` (workspace.json · 리뷰 대상에서 지우고 sync, 이름이 남은 문서를 알림. 폴더는 `--delete` 일 때만, 커밋 안 한 변경 · push 안 한 커밋이 있으면 거부) | 팀 (관리자) |
| 스택 다시 감지 | `aidure detect` · 감지 힌트 `aidure detect --hint <스택> --contains <정규식>` | 팀 |
| 진단 | `aidure doctor` | 보기 |
| 비밀값(토큰) 보기 · 확인 | `aidure secret list [--all]` (이름 · 범위 · 저장소 · 지금 읽는 곳, 값 없음) · `aidure secret test <이름>` (유효성 · 권한 · 만료) | 보기 |
| 비밀값 넣기 | **AI 가 하지 않는다.** 사용자에게 별도 터미널에서 `aidure secret set <이름>` (전역은 `--global`) 을 실행하라고 알린다. 값은 숨김 입력이라 대화에 오지 않는다. 사용자가 값을 대화에 붙여 넣으면 쓰지 말고 다시 발급하라고 알린다 | 이 PC |
| 비밀값 지우기 · 옛 위치에서 옮기기 | `aidure secret rm <이름> [--global]` · `aidure secret import --global\|--project` (telegram.env · gitlab-token · 환경변수 → OS 저장소, 옛 파일은 *.migrated) | 이 PC |
| 명령에 토큰 넣어 실행 | `aidure secret exec [--only A,B] -- <명령>` (그 명령에만 환경변수로. 값은 출력하지 않는다) | 이 PC |
| 생성물 다시 맞추기 · 검사 | `aidure sync` (정본 → AGENTS.md · 스킬 · 훅) · `aidure check` (생성물이 정본과 같은지 · 예산) | 이 PC |
| 이 PC 의 워크스페이스 목록 | `aidure list` | 보기 |
| 알림 설정 화면 (사용자가 직접) | `aidure notify setup`: 터미널 화면이라 AI 가 대신 못 한다. 사용자에게 명령을 알려 주고, AI 가 바꿀 때는 아래 명령 | 이 PC |
| 이 PC 설정 초기화 | `aidure reset <local,channel,state,guide,secrets> --yes` (팀 설정 · repos 는 그대로). 지우기 전에 사용자에게 무엇을 지울지 확인한다 | 이 PC |
| 텔레그램 개인 봇 | 연결은 **AI 가 하지 않는다**: 사용자에게 별도 터미널에서 `aidure notify my setup` (토큰은 숨김 입력, 봇 바꾸기는 `--new`) 을 실행하라고 알린다. 사용자가 토큰을 대화에 붙여 넣으면 쓰지 말고 다시 발급하라고 알린다. AI 가 하는 것: 제거 `aidure notify my remove` · 상태 `aidure notify` · `aidure notify my test` | 이 PC |
| 알림 수준 · 자리 비움 | `aidure notify my level all\|decisions\|progress\|off`(전체 · 결과와 결정 · 진행 현황 · 끄기) · `aidure notify my away on\|off`(결정을 텔레그램 버튼 질문으로. 자리에 있으면 선택 대기 · 모든 작업 끝 한 줄만) · 리모트 컨트롤(Claude 앱) 연결 중 텔레그램 `remote done\|quiet\|send`(기본 작업 끝만) · 결과 기준 `min <초>` · PC 앞이면 끝남 알림 생략 `desk <초>\|off`(기본 120초, "자리에 있을 땐 알림 꺼줘") · 진행 현황 간격 `channel progress <분\|off>` | 이 PC |
| 음성 알림 | `aidure notify my voice on\|off` · `scope both\|decisions\|done\|all`(결정+끝남 · 결정만(기본) · 끝남만 · 모두) · `name <목소리>`(macOS 한국어 Yuna · Reed · Eddy · Flo 등) · `test`. "음성 켜줘" · "목소리 남자로" · "결정만 음성으로" 같은 말에 쓴다 | 이 PC |
| 양방향 텔레그램 (프로젝트 전용 봇 · 기본 꺼짐) | `aidure notify my channel on` · `off` · `status`. 봇 토큰은 사용자가 터미널에서 숨김 입력으로 넣는다 (처음 켤 때 · 봇 바꾸기 `channel on --new`). 이미 등록된 봇이면 AI 가 `channel on` 으로 다시 점검할 수 있다. 켜면 `aidure start` 가 `--channels` 를 붙이고 이 워크스페이스 알림도 그 봇으로 (Bun · claude.ai 로그인 필요) | 이 PC · 이 프로젝트 |
| 팀 방 알림 · 공지 | `aidure notify team setup` (팀 봇 토큰은 사용자가 터미널에서 숨김 입력) · `aidure notify team chat <그룹방 ID\|off>` · `aidure notify team announce "<내용>"` | 이 PC · `chat` 은 팀 |
| 지난 작업 기록 찾기 | `aidure handoff find <티켓·기능 이름>` | 보기 |
| 문서 사이트 만들기 · 어긋남 검사 | `aidure docs build [기획 repo]` · `aidure docs check [기획 repo]` (md · 화면설계서 장 → `docs-site/` · 근거 색인). Pages 를 켠 repo 는 `docs-site/` 를 커밋한다 | 기획 repo |
| 워크스페이스 전체 문서 사이트 (여러 repo 산출물을 한 사이트로) | 워크스페이스 루트에서 `aidure docs build .` (`repos/` 의 repo 마다 사본 · 링크 · 뺌은 루트 `docs-site.json` 의 `repos`) | 팀 (`docs-site/` 를 커밋할지는 팀이 정한다) |
| 문서 사이트를 Pages 로 올리기 켜고 끄기 · 상태 | `aidure docs pages on [repo]` · `aidure docs pages off [repo]` · `aidure docs pages` (on = 원격에 맞는 CI 파일 · `docs-site/` 커밋, off = `.gitignore` 에 `/docs-site/`) | 기획 repo |
| Codex 웹 검색 끄기 · 켜기 | `workspace.json` 의 `agents.webSearch` 를 `false` 로 (지우면 켬. `aidure start` 가 Codex 에 `--search` 를 붙인다) | 팀 |
| 워크스페이스 현황판 | `aidure board` (로드맵 · 팀원별 마지막 핸드오프 · 미완 작업 · 공지 + 기록 쪽을 `.agents/board/` 에 만들어 브라우저로 연다. 보기 전용) | 이 PC |
| 다른 도구에 맡긴 작업(위임) 진행 보기 | `aidure delegate watch [작업 id]` (상대 에이전트가 읽고 실행하는 것이 줄마다) · `aidure delegate status [작업 id]` (지금 현황 한 번) · `aidure delegate list` | 워크스페이스 |
| 문서 사이트를 이 PC 에서 웹 주소로 보기 | `aidure docs serve [repo]` (`http://127.0.0.1:8000/`, `--open` 이면 브라우저도 연다. 끝내기 Ctrl+C) | 기획 repo |
| 문서 사이트 메뉴 묶음 · 이름 · 버전 바꾸기 | 기획 repo 의 `docs-site.json` 을 고치고 `aidure docs build` (README 의 「문서 사이트」 절 형식) | 기획 repo |
| 기획 문서 ID 하나 보기 · 쓰는 곳 찾기 | `aidure docs show <ID> [--in <파일 조각>] [--all]` (정의 부분만) · `aidure docs refs <ID> [--docs]` (기획 · 코드 · 이슈 repo 의 파일:줄). "FN-001 내용" · "이 결정 어디서 써?" 같은 말에 쓴다 | 보기 |
| 본문 근거를 인용구로 옮기기 | `aidure docs refs-quote <md 파일…> [--dry]` (본문 괄호 속 파일:줄을 그 문단 · 목록 · 표 아래 「> 근거:」 로). 「파일:줄 참조」 경고가 많을 때 · "근거 인용구로 빼 줘" 같은 말에 쓴다 | 기획 repo |
| 기획과 코드 대조 | `aidure docs trace [--ids FN] [--all]` (코드 주석에 구현 표시가 없는 기획 ID · 기획에 정의 없는 코드의 ID). "기획대로 다 만들었어?" · "코드랑 문서 어긋난 곳" 같은 말에 쓴다. 머리말은 `vars.docs.traceIds` | 보기 |
| 리뷰 확인 (commit · push 전에 리뷰를 거쳤나) | 상태 `aidure review status` (대상 repo 마다 리뷰 안 된 줄 수 · 마지막 리뷰) · 훅이 알 수 없는 방법으로 리뷰했으면 `aidure review mark [--repo <이름>] [--by "<누가>"]` · 생략은 **사용자에게 먼저 묻고 승인받았을 때만** `aidure review skip --reason "<사유>"` (다음 한 번). 켜기 · 수준 · 대상은 `aidure team-mode enforce review off\|warn\|block [--repos a,b\|*] [--min-lines N] [--paths p1,p2] --team` (기본 꺼짐) | 이 PC · 수준은 팀 |
| GitLab 파이프라인 보기 | `aidure gitlab pipeline [--repo <이름>] [--ref <브랜치> \| --mr <번호> \| --id <파이프라인 ID>] [--limit N] [--log] [--json]` (최근 목록 · 단계별 작업 상태 · `--log` 는 실패한 작업의 로그 끝부분. 읽기만 한다, gitlab 팩). "파이프라인 통과했어?" · "배포 왜 깨졌어?" 같은 말에 쓴다. MR 은 MR 파이프라인이 없으면 머지 커밋의 것을 찾는다 | 보기 |
| 기획 repo 새로 만들기 | `aidure init-docs <폴더>` 로 뼈대를 만들고 `aidure repo add <폴더> --kind docs` 로 등록 | 팀 |
| 화면설계서 검사 | `aidure screens check [기획 repo]` (근거 ID · 화면 ID 중복 · 기능 ID 누락). 화면설계서 작성 절차는 `screens` 스킬 | 보기 |
| 데이터 설계 검사 | `aidure datamodel check [기획 repo]` (참조 · 기본키 · 중복 · 표 형식 · 컨벤션 · 기능 ID 대조). 작성 절차는 `datamodel` 스킬 | 보기 |
| 팩 켜기 (upgrade 가 「꺼져 있음」 이라 알린 기본 팩 · 다른 유형의 screens · datamodel 등) | `aidure upgrade --add <팩,팩>` | 팀 |
| 킷 새 버전 반영 | `aidure upgrade` | 팀 |

- 역할 이름: `analyst` · `architect` · `implementer` · `tester` · `reviewer` · `documenter`, 메인 `main`, 교차 검토 `crossReview`.
- 모델 이름은 `aidure models` 결과나 `packs/core/models.json` 의 목록에서 고른다. 없는 이름을 지어내지 않는다.
- 규칙 ID 는 `aidure rules list` 로 확인한다. 킷 규칙을 **우리 방식으로 바꾸려면** 끄지 말고 `packs/project/rules/<이름>.md` 에 `replaces: <ID>` 를 둔다.

## 2. 실행 전에

- **범위가 "팀" 인 명령은 실행 전에 사용자에게 무엇이 바뀌는지 보여 주고 확인받는다.** `workspace.json` 이 바뀌고, commit · push 하면 팀 전체에 적용된다.
- 이 PC 범위(`--team` 없는 models · agent)는 요청이 분명하면 바로 실행한다.
- 설정 수정이 막혀 있다고 나오면(관리자가 아님) 우회하지 않고 사용자에게 관리자에게 요청하라고 알린다.
- 게이트웨이 키 **값**을 묻거나 대화·파일에 적지 않는다. 키가 든 환경변수 **이름**만 쓴다.

## 3. 실행하지 않는 것

- `aidure start` (에이전트 안에서 에이전트를 또 띄운다) · `aidure init` · `aidure remove` (선택 화면·삭제). 필요하면 사용자에게 터미널에서 직접 하라고 안내한다.
- 설정 파일(`workspace.json` · `packs/` · 생성물)을 손으로 고치는 것. 명령이 없는 설정만 직접 고치고, 고친 뒤 `node bin/kit.js sync` 를 돌린다.

> Codex: 샌드박스가 네트워크를 막는다. 네트워크가 필요한 명령(`aidure install` 의 clone, `aidure team` 의 fetch, `aidure ai gateway` · `refresh` 의 모델 조회)이 막히면 샌드박스 밖 실행 승인을 요청한다.

## 4. 보고

실행한 명령 · 바뀐 것(전후) · 팀 범위면 "`workspace.json` 을 commit · push 해야 팀에 적용" 을 알린다. 모델을 바꿨으면 명령이 보여 준 결과로 적용된 값을 확인해 적는다.
