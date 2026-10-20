# 인프라 환경 표 양식: project 팩에 복사해 채운다

`infra` 팩은 실제 환경을 모른다. 아래 표를 `packs/project/rules/` 의 룰(예: `20-infra-environments.md`,
`load: always` 이면 짧게, 길면 `on-demand`)로 옮겨 프로젝트 값을 채운다. **비밀값은 적지 않는다.**

```markdown
---
title: 인프라 환경
load: always
---

## 인프라 환경

| 별칭 | 클러스터 · kube 컨텍스트 | 네임스페이스 | 클라우드 계정 · 리전 | IaC state 위치 | 배포 방법 | 비고 |
|---|---|---|---|---|---|---|
| local | docker compose | - | - | - | `docker compose up` | 개발용 |
| dev | dev-cluster · `dev-admin` | app-dev | <계정> · <리전> | <원격 state 경로> | 파이프라인 (main) | |
| prd | prd-cluster · `prd-deployer` | app | <계정> · <리전> | <원격 state 경로> | 파이프라인 + 승인 | **직접 반영 금지** |

- 비밀 출처: <비밀 저장소 경로 · CI 변수 이름>
- 모호한 "개발 서버" = dev 인지 확인받는다.
- 운영 컨텍스트는 로컬 기본 컨텍스트로 두지 않는다.
```
