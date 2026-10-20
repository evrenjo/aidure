---
title: Kubernetes · Helm
load: on-demand
when: Kubernetes 매니페스트 · Kustomize · Helm 차트 · values 를 만들거나 고칠 때, 배포 · 롤아웃 · 스케일 설정을 바꿀 때
---

## Kubernetes · Helm

- **선언형으로 관리한다.** 매니페스트 · 차트를 버전 관리하고, 클러스터에서 직접 고친(`kubectl edit`) 것은 파일에도 남긴다. 반영 전 `kubectl diff` 또는 `helm template`(+ diff)로 바뀌는 것을 본다.
- **리소스 요청 · 한도**: 컨테이너마다 `resources.requests`(CPU · 메모리)를 두고, 메모리 `limits` 를 둔다. 값은 측정 근거로 정한다.
- **프로브**: `readinessProbe` 로 트래픽 받을 준비를, `livenessProbe` 로 재시작 기준을, 기동이 느리면 `startupProbe` 를 둔다. liveness 가 외부 의존(DB 등)을 검사하지 않게 한다 (의존 장애가 연쇄 재시작이 된다).
- **보안 컨텍스트**: `runAsNonRoot` · `allowPrivilegeEscalation: false` · 불필요한 capability 제거 · 가능하면 읽기 전용 루트 파일시스템. 네임스페이스는 Pod Security Standards(restricted 우선)를 따른다.
- **이미지**: 태그(가능하면 digest)를 고정한다. `latest` 처럼 바뀌는 태그에 기대지 않는다.
- **비밀**: Secret 매니페스트에 값을 넣어 커밋하지 않는다. 프로젝트의 비밀 관리 방식(외부 비밀 저장소 연동 · 암호화된 Secret 등)을 따른다.
- **롤아웃**: 무중단이 필요하면 복제 2개 이상 · 롤링 업데이트 설정 · PodDisruptionBudget 을 함께 본다. 되돌리기는 `kubectl rollout undo` · `helm rollback` 중 프로젝트 방식으로.
- **Helm 차트**: values 는 기본값을 안전하게(작은 리소스 · 비루트), 이름은 공식 모범 사례의 레이블(`app.kubernetes.io/*`)을 쓴다. 차트 버전과 앱 버전을 따로 올린다. `helm lint` 를 돌린다.
- 검증: `kubectl apply --dry-run=server`(권한이 있으면) 또는 `--dry-run=client`, `helm lint` · `helm template` 결과를 보고에 붙인다.
