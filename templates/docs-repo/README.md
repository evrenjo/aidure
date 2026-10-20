# <프로젝트명> 기획 문서

기획자가 관리하는 **요구사항의 정본**이다. 개발 워크스페이스의 AI 에이전트는 이 repo 를 읽기 전용으로 참조하고,
답변·코드·이슈에 **파일 경로 + ID**(예: `01-requirements/REQ-001.md`)로 근거를 단다.

## 폴더

| 폴더 | 내용 |
|---|---|
| [00-overview/](00-overview/) | 프로젝트 개요(범위 · 구성 · 핵심 흐름 · 핵심 결정) · [미결 목록](00-overview/open-questions.md) |
| [01-requirements/](01-requirements/) | 요구사항 — 파일 하나에 ID 하나 (`REQ-001.md`) |
| [02-screens/](02-screens/) | 화면설계서: 화면 목록(`README.md`) + 장 HTML(`_template.html` 양식, 설계서 하나 = 한 파일) |
| [03-policies/](03-policies/) | 업무 규칙·정책 (`POL-001.md`) |
| [04-glossary/](04-glossary/glossary.md) | 용어집 — 워크스페이스가 도메인 용어를 여기서 찾는다 |
| [05-decisions/](05-decisions/) | 결정 기록 (`DEC-001.md`) |
| [06-data/](06-data/) | 데이터 설계: 엔티티 목록 · 컨벤션(`README.md`) + 스키마마다 테이블 정의서(`_template.md` 양식). ERD 는 문서 사이트가 만든다 |
| [originals/](originals/) | Word·Excel·PPT·PDF 원본 |
| [md/](md/) | 원본의 md 사본 — 에이전트가 읽는 쪽 |
| `docs-site/` | 문서 사이트 (`aikit docs build` 가 만든다. 손으로 고치지 않는다) |

각 폴더의 `_template.md` 를 복사해 새 문서를 시작한다.

## 작성 규칙

- **ID 는 한 번 붙이면 바꾸지 않는다.** 번호를 다시 매기지 않고, 폐기한 ID 는 상태를 `폐기` 로 두고 파일을 남긴다.
  에이전트·이슈·코드 주석이 그 ID 를 이미 인용하고 있다.
- **요구사항 하나에 ID 하나.** 두 가지를 말하면 두 파일로 나눈다.
- 화면설계서는 장 양식(표지 · 변경 이력 · 메뉴 구조 · 정책 · 화면)을 따른다. 화면 장은 메타 표(화면 ID · 경로 · Related ID) · 와이어프레임 · 번호별 설명 · Check Point · 근거 ID 를 채운다.
- 문서 맨 위에 **상태**를 적는다.

  | 상태 | 뜻 |
  |---|---|
  | `초안` | 작성 중. 개발 근거로 쓰지 않는다 |
  | `검토중` | 내용은 있으나 확정 전. 개발 시 확인 요청 대상 |
  | `확정` | 개발 근거로 쓴다 |
  | `폐기` | 더 이상 유효하지 않다. 파일은 남긴다 |

- 결정이 내려지면 [05-decisions/](05-decisions/) 에 남기고, 영향받는 요구사항·화면에서 그 `DEC-` ID 를 건다.
- 정하지 못한 것은 [미결 목록](00-overview/open-questions.md) 한 곳에 모으고, 각 문서 끝에는 그 ID 링크만 둔다.
- 표 칸은 한두 문장으로 쓴다. 긴 설명은 표 아래 소절로, 흐름 · 구성은 mermaid 그림으로 그린다.
- 문서 **맨 아래 변경 이력**에 한 줄씩 추가한다 (날짜 · 변경 내용 · 작성자 역할).
- 용어는 [04-glossary/glossary.md](04-glossary/glossary.md) 에 먼저 정의하고 본문에서 같은 말을 쓴다.

## 원본과 md 사본

AI 에이전트는 Word·Excel·PPT 를 안정적으로 읽지 못한다. 그래서 원본은 `originals/` 에, 읽을 수 있는 사본은 `md/` 에 **같은 경로로** 둔다.

```
originals/화면설계/주문관리.pptx   →   md/화면설계/주문관리.md
```

- **원본을 고치면 같은 커밋에서 md 사본도 고친다.** 사본이 낡으면 에이전트는 낡은 요구사항으로 개발한다.
- md 사본 맨 위에 원본 경로와 반영 날짜를 적는다 (`md/README.md` 참고).
- 처음부터 md 로 쓰는 문서(`01-requirements/` 등)는 원본이 없어도 된다.
- 워크스페이스 `workspace.json` 에는 이 repo 를 `"kind": "docs", "mdPath": "md"` 로 등록한다.

## 에이전트가 이 repo 를 쓰는 방법

- 근거는 `파일 경로 + ID` 로 인용한다. 상태가 `확정` 이 아닌 문서는 근거로 쓸 때 그 사실을 밝힌다.
- 문서에 없는 동작은 만들어 넣지 않고 **확인 요청**으로 올린다.
- 이 repo 안에서 작업하는 에이전트의 규칙은 [AGENTS.md](AGENTS.md).

## 문서 사이트

`aikit docs build` 가 이 repo 의 md 와 화면설계서 장을 같은 경로 구조의 HTML(`docs-site/`)로 만든다. 정의된 ID(`### REQ-001 …` 제목, 표 첫 칸)에 앵커가 붙고,
본문 · 화면설계서의 ID 를 누르면 그 정의로 간다 (`docs-site/assets/ids.json` 이 색인).

- md 나 장을 고치면 `aikit docs build` 로 다시 만들어 **같은 커밋에** 넣는다. 어긋나면 pre-commit 이 막는다.
- 구성도 · 흐름도는 ` ```mermaid ` 블록으로 쓰면 사이트에 그림으로 나온다 (확대 · 새 창). 문법이 틀리면 build · pre-commit 이 ✖ 로 알리고, ASCII 그림은 ⚠ 로 알린다. 시스템 구성도(단계별 · 서버 사양)는 워크스페이스 에이전트의 architecture 스킬이 견본대로 만든다.
- Pages 로 올리기(선택): `aikit docs pages on` 이 원격에 맞는 CI 만 남기고 `docs-site/` 를 커밋 대상으로 한다. GitLab 은 `.gitlab-ci.yml` (서버에 Pages 와 러너가 있어야 한다), GitHub 은 `.github/workflows/pages.yml` (한 번만 Settings > Pages > Source 를 GitHub Actions 로, 비공개 repo 는 유료 요금제). 올리지 않으면 `aikit docs pages off` (`.gitignore` 에 `/docs-site/`).
- Pages 가 없으면 받아서 연다: `python3 -m http.server -d docs-site` (file:// 로도 열린다).
- 메뉴 묶음 · 사이트 이름 · 버전 · 원본 보기 주소 · 포함 범위(`include` · `exclude` glob)는 `docs-site.json` 으로 정한다 (없으면 폴더와 파일 이름 앞 번호로 묶는다).

## 바이너리 파일

`.gitattributes` 가 Office·PDF·이미지 파일을 바이너리로 표시한다. 원본이 커져 repo 가 무거워지면
Git LFS(`git lfs track "*.pptx"` 등)를 검토한다 — 이 템플릿은 LFS 를 켜 두지 않는다.
