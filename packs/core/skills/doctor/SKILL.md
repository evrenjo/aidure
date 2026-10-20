---
name: doctor
description: 워크스페이스 셋업·환경(Node·git·repos/ 의 repo·훅 경로·kit 생성물·에이전트 CLI)을 진단한다. 처음 받았을 때나 뭔가 깨졌을 때 쓴다.
---

# doctor — 워크스페이스 진단

## 절차

1. 워크스페이스 루트에서 실행한다 (읽기 전용 — 아무것도 고치지 않는다).

   ```bash
   node packs/core/bin/doctor.js      # exit 0 = 정상, 1 = 문제 있음
   ```

2. 출력을 가공하지 말고 그대로 보여 주고, 끝에 한 줄 요약: "환경 정상" 또는 "문제 N건 — 안내대로 조치 후 다시 doctor".
3. 사용자가 특정 항목을 물으면 아래 표로 설명한다. **조치는 사용자가 하거나, 사용자가 요청할 때만** 대신 실행한다.

## 검사 항목

| 항목 | 뜻 | 실패 시 |
|---|---|---|
| Node.js | 18 이상 | nodejs.org 에서 설치 |
| git | 설치 여부 | git 설치 |
| git: 워크스페이스 | 루트가 git 저장소 | `git init` 또는 clone |
| 개발자 ID | 루트 `git config user.name` (핸드오프 폴더·호칭에 쓴다) | `git config user.name <id>` |
| git core.hooksPath | `.githooks` 로 설정됐는가 (pre-commit 검사) | `aikit install` |
| repo: {이름} | `workspace.json` repos 가 `repos/<이름>` 에 있고 git 저장소인가. `local: true`(원격 없이 새로 만든 repo)면 원격이 생겼는가 | `aikit install` · 원격 없음이면 만든 사람이 origin 을 달고 push |
| kit check | 생성물이 정본(`packs/`·`workspace.json`)과 같은가 | 정본을 고치고 `node bin/kit.js sync` |
| 죽은 참조 | 문서가 없는 경로를 가리키는가 | `node packs/core/bin/check-refs.js` 로 목록 확인 |
| CLI: Claude Code / Codex | 에이전트 CLI 설치 여부 (둘 중 하나 이상 필요) | 쓸 도구 설치 |

## 처음 받은 사람의 순서

```
1. workspace.json 의 repos 를 path 위치에 clone
2. 워크스페이스 루트에서 aikit install   (repos/ clone + 훅 경로 + sync)
3. git config user.name <id>
4. doctor 로 확인 → 모두 정상이면 resume 또는 go
```

> Codex: 프로젝트 훅·설정은 이 프로젝트를 trusted 로 지정해야 적용된다 (`/hooks`). 훅 내용이 바뀌면 다시 신뢰해야 한다.
