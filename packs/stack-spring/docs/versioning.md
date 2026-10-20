# 버전·변경 기록 (stack-spring)

## 버전 형식 — Semantic Versioning `MAJOR.MINOR.PATCH`

| 구분 | 올리는 때 |
|---|---|
| MAJOR | 첫 운영 배포, 하위 호환이 깨지는 변경, 대규모 구조 변경 |
| MINOR | 기능·화면 추가, API 신규/변경, DB 스키마·enum 변경 |
| PATCH | 버그·스타일·설정·문서 수정, 문구 변경 |

- 위치: 백엔드 `build.gradle` `version`, 프론트 `package.json` `version`.
- **버전업은 사람이 지시할 때만** 한다. 사이클이 끝났다고 "vX.Y 권장" 을 제안하지 않는다. 머지·재배포는 bump 트리거가 아니다.
- 올리는 자리는 작업 브랜치다 (보호된 통합 브랜치를 직접 고치지 않는다).
- 버전 값이 실제 배포를 식별하지 않는 프로젝트라면(항상 SNAPSHOT 등) 그 사실을 project 팩 룰에 적고, 무엇이 배포됐는지는 커밋 해시로 말한다.

## 변경 기록 (CHANGELOG / 릴리스 노트)

버전을 올릴 때 **읽는 사람이 겪는 변화**로 적는다 — 커밋 목록을 옮기지 않는다.

```
## [0.10.0]

[Backend]
- 신규: GET /orders/v1/orders/next-number
- 변경: 주문 상태 PENDING → PROVISIONED

[Frontend]
- 신규: 주문 추가 드로어
- 수정: 다크모드 로고 가시성

[Infra]
- 수정: Gradle 태스크 의존성
```

- 카테고리 Backend / Frontend / Infra, 접두사 `신규:` / `변경:` / `수정:`. 해당 없는 카테고리는 생략.
- API 는 `METHOD /path — 설명`.
