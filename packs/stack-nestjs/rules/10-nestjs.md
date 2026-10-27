---
title: NestJS 레이어 책임 · 모듈 · 공통 처리
load: always
---

## NestJS 레이어 책임 · 모듈 · 공통 처리

기존 프로젝트의 모듈 구조 · 폴더 이름이 먼저다. 공통 원칙은 clean-code 팩 「레이어 책임 · 공통 로직 추출」.

- **Controller:** 라우팅 · DTO 바인딩 · 서비스 호출만. 업무 로직은 provider 로 위임한다.
- **Service (provider):** 그 모듈의 유스케이스. 다른 모듈 데이터는 그 모듈이 `exports` 한 provider 로 받는다 (남의 저장소를 직접 주입하지 않는다).
- **Module:** 조립(imports · providers · exports)만, 로직 금지. `@Global()` 은 설정 · DB 연결 같은 진짜 전역에만.
- **꺼낼 곳:**
  - 요청 공통 처리: 검증 · 변환 `*.pipe.ts`, 권한 `*.guard.ts`, 응답 · 로깅 `*.interceptor.ts`, 예외 `*.filter.ts`, 매개변수 추출 `*.decorator.ts`. 컨트롤러 안 private 함수로 흉내 내지 않는다.
  - 입력 검증: DTO + class-validator (또는 프로젝트의 스키마 도구).
  - 변환은 `*.mapper.ts`, 상수 묶음은 `*.constants.ts` 또는 enum, 환경 값은 `ConfigService` · 설정 네임스페이스.
  - 여러 모듈이 쓰는 서비스는 공용 모듈이 `exports`. 상태 없는 순수 함수는 그 기능 폴더, 여러 기능이면 기존 공용 폴더.
- 파일 이름은 Nest CLI 꼴 (`<이름>.<종류>.ts`), 클래스는 `<이름><종류>` (`OrderPolicy`, `PriceMapper`).
- `CommonService` · `HelperService` 처럼 무엇이든 넣는 provider 를 만들지 않는다.
