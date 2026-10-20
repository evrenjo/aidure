---
title: IaC (Terraform · OpenTofu · Ansible)
load: on-demand
when: Terraform · OpenTofu · Terragrunt 코드, state · 백엔드 · 모듈 · 프로바이더, Ansible 플레이북 · 인벤토리 · 롤을 만들거나 고칠 때
---

## IaC (Terraform · OpenTofu · Ansible)

### Terraform · OpenTofu

- **state 는 원격 백엔드에 두고 잠금을 켠다.** state 파일을 repo 에 커밋하지 않는다 (비밀값이 평문으로 들어 있다).
- **plan 을 보고 반영한다.** `plan -out` 으로 저장한 계획을 승인받아 그대로 `apply` 한다. 삭제 · 교체(`-/+`)가 있으면 맨 위에 적는다.
- **버전 고정**: `required_version` · `required_providers` 의 버전 제약, 모듈 버전, `.terraform.lock.hcl` 커밋.
- **state 를 손으로 고치지 않는다.** 이름 바꾸기는 `moved` 블록, 기존 리소스 가져오기는 `import` 블록으로 코드에 남긴다. `state rm` · `state mv` 는 승인받은 경우만.
- 환경은 디렉터리 · 워크스페이스 중 프로젝트 방식을 따르고, 지금 어느 환경을 가리키는지 명령 전에 확인한다.
- 비밀 변수는 `sensitive = true`, 값은 비밀 저장소 · CI 변수에서 받는다.
- 검증: `fmt -check` · `validate` · `plan` 결과 요약(추가 · 변경 · 삭제 수).

### Ansible

- **멱등하게 쓴다.** 모듈을 쓰고, `command` · `shell` 은 `creates` · `changed_when` 으로 다시 돌려도 바뀌지 않게 한다.
- **`--check --diff` 로 먼저 본다.** check 모드를 지원하지 않는 작업은 보고에 적는다.
- 대상은 인벤토리 · `--limit` 으로 좁히고, 운영 대상은 승인받은 뒤에.
- 비밀은 Ansible Vault 나 외부 비밀 저장소로. 출력에 비밀이 찍히는 작업은 `no_log: true`.
- 검증: `ansible-lint` · `--syntax-check` · check 모드 결과.
