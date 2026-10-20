---
title: 인프라 작업 안전 원칙
load: always
---

## 인프라 작업 안전 원칙

- **어느 환경인지 먼저 확정한다.** 클러스터·kube 컨텍스트·네임스페이스, 클라우드 계정·리전, Terraform 워크스페이스·state, 인벤토리를 확인한다. 환경 표는 project 팩에 있다. "개발 서버" 처럼 여러 곳을 가리킬 수 있는 말이면 작업하지 말고 묻는다.
- **운영 환경에 직접 반영하지 않는다.** 반영은 파이프라인이나 별도 승인 절차로.
- **반영 전에 바뀌는 것을 보인다**: `terraform plan` · `kubectl diff` · `helm diff`(플러그인) 또는 `helm template` · `ansible-playbook --check --diff`. 결과의 추가 · 변경 · **삭제 · 교체** 수와 이름을 적는다.
- **파괴적 작업**(destroy · 리소스 삭제 · `state rm`/`mv` · 강제 교체 · 네임스페이스 삭제 · 볼륨 삭제)은 대상과 되돌릴 방법을 적은 뒤 **그 건마다 승인**받는다.
- **비밀값은 파일 · 이미지 · 로그 · 보고에 넣지 않는다.** 비밀 저장소 · CI 변수 이름 같은 **출처만** 가리킨다.
- **버전을 고정한다**: 이미지 태그(가능하면 digest) · 차트 · 프로바이더 · 모듈 · 액션. `latest` 처럼 떠다니는 값을 쓰지 않는다.
- 결과·근거는 **실행한 명령과 출력 요약**으로 적는다. 못 돌렸으면 "미실행" 과 이유.
- 해당 작업 전에 읽는다: 컨테이너 `packs/infra/rules/20-containers.md` · Kubernetes·Helm `packs/infra/rules/30-kubernetes.md` · IaC·Ansible `packs/infra/rules/40-iac.md` · 배포 파이프라인 `packs/infra/rules/50-pipelines.md`
