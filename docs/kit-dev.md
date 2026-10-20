# 킷 개발

킷 repo 를 고치는 사람을 위한 문서다. 킷 문서 사이트(`docs-site/`)의 「킷 개발」 묶음에 있다. 작업 지침은 `AGENTS.md`, 모델 추천 갱신 절차는 [모델 카탈로그 관리](model-catalog.md).

## 새 팩 추가

여러 프로젝트에 두루 쓸 규칙이면 킷의 팩으로 만든다. 모든 워크스페이스가 `aikit upgrade` 로 받는다.

1. 킷 repo 에 `packs/<이름>/pack.json` 을 만든다 (`name` · `title` · `summary` · `description` · `category` · `requires`).
2. `rules/` · `skills/` · `hooks.json` · `bin/` 을 필요한 만큼 둔다. 종류(`category`)에 따라 붙는 조건이 정해진다 (`docs/packs.md`).
3. 스택 팩이면 `packs/core/stacks.json` 에 감지 조건을 더한다.
4. `npm test` 로 검사하고(생성 · 죽은 참조 · 예산 · 금지 문자열), `npm run docs` 로 팩 목록을 다시 만든다.
5. 커밋 · push 하면 배포된다. 각 워크스페이스는 `aikit upgrade`.

## 스택 목록 (`stacks.json`)

위치: `packs/core/stacks.json`

repo 를 보고 스택을 감지하는 조건이다. **새 기술은 여기에 한 줄**을 더하면 감지되고 layer 공통 규칙이 붙는다.
전용 규칙까지 주려면 stack 팩을 만들고 그 항목에 `"pack"` 을 적는다.

```json
{ "id": "fastapi", "label": "FastAPI", "layer": "backend", "pack": "stack-fastapi",
  "detect": [{ "files": ["pyproject.toml", "requirements*.txt"], "contains": "fastapi" }] }
```

- `detect` 는 조건 목록(하나라도 맞으면 감지). 조건 = 파일 이름(`*` 허용, 깊이 4 까지) + 선택적 내용 정규식.
  소스 파일 표식처럼 깊은 곳을 봐야 하면 `"depth": 9` 처럼 적는다(최대 10). 깊은 조건은 느리니 빌드·설정 파일 조건 뒤에 둔다.
- 프로젝트 전용 조건(사내 라이브러리 좌표)은 킷이 아니라 워크스페이스의 `workspace.json` `stackHints` 에 둔다 (`aikit detect --hint`).
- 감지 결과는 `workspace.json` 의 `repos[].stacks` 에 저장되고 사람이 고칠 수 있다 (`aikit detect`).
  멀티모듈 repo 는 스택별 모듈이 `repos[].stackPaths` 에 함께 저장되고, AGENTS.md repo 별 규칙 표에서 layer·stack 팩 규칙마다 모듈 경로가 붙는다.
- `parent` 를 적으면 그 프레임워크의 세부가 된다 (예: `spring-webflux` → `spring`). 세부는 부모의 layer·팩을 함께 받는다.
- 감지 조건마다 근거(공식 문서 URL)는 `docs/stack-catalog-sources.json` 에 둔다.

## AI 도구(CLI) 추가

시작 도구는 명단제다 (지금은 Claude Code · Codex). 다른 CLI(Gemini CLI 등) 요청이 오면 아래 순서로 넣는다. 감지는 한 줄이지만 생성물이 도구마다 달라서 한 세트를 같이 만들어야 한다.

| 순서 | 어디 | 무엇 |
|---|---|---|
| 1 | `bin/aikit.js` `AGENTS` | 명령 이름 · 설치 명령 · 모델 플래그. "쓰는 AI" 선택지와 `ARG_PRESETS`(자주 쓰는 실행 인자)도 여기 |
| 2 | `packs/core/lib/cli.js` | 설치 여부·실행 파일 찾기 (`findCli`) |
| 3 | `bin/kit.js` | 그 도구의 설정 파일 생성: 규칙 파일 위치, 훅 등록 형식(`hookGroups`), 역할 에이전트 파일, 시작 도구 판정(`startToolOf`) |
| 4 | `packs/core/lib/hook.js` · `packs/core/hooks/*.js` | 훅 입출력 계약이 다르면 `--agent=<도구>` 분기. 지원하지 않는 이벤트는 `hooks.json` 의 `agents` 로 제외 |
| 5 | `packs/core/models.json` | `tools.<도구>` 모델 목록 · `profiles.*.<도구>` 역할별 추천 (조사 절차는 `model-catalog.md`) |
| 6 | `packs/core/bin/delegate.js` · `cross-review.js` | 그 도구의 비대화형 실행(`<명령> -p` 류)으로 위임·교차 검토 |
| 7 | `packs/core/bin/doctor.js` · `bin/gateway.js` | 진단 항목 · 게이트웨이 모델을 그 도구 모델명으로 잇기 |
| 8 | `docs/pack-making.md` 대응표 · `docs/workflow.md` · README | 도구별 차이 표와 흐름도 |
| 9 | `bin/selftest.js` | 생성물·훅·위임 검사에 그 도구 케이스 추가 |

- 규칙·스킬은 도구 중립이라 `AGENTS.md` 를 읽는 도구면 1~3 만으로도 규칙은 먹는다. 훅·역할 에이전트·위임은 4~6 이 있어야 한다.
- 다른 회사 **모델**만 필요하면 도구를 더하지 않는다. AI 게이트웨이로 연결하면 Claude Code 안에서 그 모델을 고를 수 있다.


