---
title: FastAPI 기본 규약
load: always
---

## FastAPI 기본 규약

기존 프로젝트의 폴더 구조 · 응답 형식을 따른다. 없으면 도메인별로 `router` · `schemas` · `service` · `dependencies` 를 묶는다.

- **라우터는 얇게:** 요청 검증 · 의존성 · 응답만. 업무 로직은 서비스 함수로.
- 엔드포인트는 `APIRouter` 로 나누고 `response_model` (또는 반환 타입) · `status_code` 를 적는다.
- 요청 · 응답은 Pydantic 모델로 나눈다 (입력 · 출력 · DB 모델 분리). 검증 규칙은 필드 제약(`Field`, `Literal`, `EmailStr`)에.
- 의존성은 `Annotated[T, Depends(fn)]` 로 쓰고 작게 나눠 연결한다. 테스트는 `app.dependency_overrides`.
- **`async def` 안에서 막히는 호출(동기 DB · requests · 파일)을 하지 않는다.** 동기 라이브러리를 쓰면 `def`, 확실하지 않으면 `def`. 무거운 계산은 작업 큐로.
- 설정은 `pydantic-settings` 의 `BaseSettings` 와 `@lru_cache` 로 만든 `get_settings` 의존성. 모듈 수준 전역 설정 객체를 만들지 않는다.
- 오류는 `HTTPException` 이나 프로젝트의 예외 처리기로. 바깥 응답에 내부 예외 내용을 넣지 않는다.
- 놓치면 안 되는 작업에 `BackgroundTasks` 를 쓰지 않는다 (프로세스가 죽으면 사라진다).
