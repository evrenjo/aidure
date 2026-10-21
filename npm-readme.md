# aidure

**Claude Code · Codex 겸용 AI 협업 워크스페이스 킷**

팀이 같은 규칙으로 AI 에이전트와 일하고, 누가 어느 PC 에서 이어받아도 작업 기록이 남는 워크스페이스(git repo 하나)를 만든다.

> 🚧 개발 중 (0.x): 명령 · 설정 형식이 바뀔 수 있습니다.

## 설치

```bash
node -v              # v20.19 이상
npm i -g aidure
aidure --version
```

Claude Code(`npm i -g @anthropic-ai/claude-code`) 나 Codex(`npm i -g @openai/codex`) 중 쓸 것도 설치돼 있어야 한다.

## 빠른 시작

| 누가 | 명령 |
|---|---|
| 리더 (처음 한 번) | `aidure init` → 유형 · repo · 쓰는 AI 를 고르면 워크스페이스가 만들어진다 |
| 팀원 (처음 한 번) | 워크스페이스 repo 를 clone → `aidure install` |
| 모두 (매일) | `aidure start` |
| 킷 새 버전 | `npm i -g aidure` → 워크스페이스에서 `aidure upgrade` |

## 더 보기

- 문서 · 화면: https://github.com/lsnwan/aidure
- 변경 기록: 패키지 안 `CHANGELOG.md`
- 라이선스: MIT
