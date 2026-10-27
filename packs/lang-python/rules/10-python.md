---
title: Python 클린 코드
load: always
---

## Python 클린 코드

기존 프로젝트 관례(포매터 · 린터 설정 · 폴더 구조 · docstring 형식)가 먼저다. 형식은 `ruff format` 등 repo 의 포매터에 맡긴다.

### 이름
- 모듈 · 함수 · 변수 `snake_case`, 클래스 `CapWords`, 상수 `UPPER_SNAKE`. bool 은 `is_` · `has_`, 함수는 동사, 단위는 이름에 (`timeout_s`).

### 함수
- 한 가지 일. 인자가 많으면 `*` 뒤 키워드 전용으로. 기본값에 `[]` · `{}` 금지 (`None` 을 받아 안에서 만든다). 플래그 bool 인자 대신 함수를 나눈다.

### 클래스
- 데이터 묶음은 `@dataclass` · Pydantic 모델, 상태 없는 동작은 모듈 함수 (불필요한 클래스 · 추상층을 만들지 않는다). 상속보다 조합. `@property` 는 가벼운 계산만.

### 주석 · docstring
- 공개 함수 · 클래스에 docstring (PEP 257: 첫 줄 요약, 형식은 repo 의 Google · NumPy 중 하나). 타입 힌트와 같은 내용을 되풀이하지 않는다.

### 타입 힌트
- 공개 함수 인자 · 반환 모두. `X | None`, `list[int]` (내장 제네릭), 필요하면 `TypedDict` · `Protocol` · `Literal`. 문법은 `requires-python` 버전 안에서. `Any` · `# type: ignore` 는 이유를 적고 최소로.

### 읽히는 코드 · 관용구
- 조건 · 계산에 이름을 붙인다 (`is_expired = ...`). 매직 넘버는 상수 · `Enum`. 컴프리헨션은 for 하나 · 조건 하나까지, 넘으면 반복문.
- `with` 로 자원 정리, `enumerate` · `zip(strict=True)`, `pathlib`, f-string, `is None`, 빈 컨테이너는 `if not items`.
- 로그는 `logging` (`print` 금지), 인자는 `logger.info("%s", x)` 처럼 따로 넘긴다.
- 실행 코드는 `main()` 과 `if __name__ == "__main__":`. import 는 표준 · 외부 · 내부 순, 와일드카드 금지.

### 예외
- 구체 예외만 잡고 `try` 블록은 짧게. 다시 던질 때 `raise ... from e`. 검증에 `assert` 를 쓰지 않는다.

### 하지 않는 것
- 전역 변경 상태, 메타클래스 · 몽키패치 같은 마법, 동작을 숨기는 데코레이터, bare `except`, 포매터와 다투는 손 정렬.
