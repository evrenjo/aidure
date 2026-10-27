---
title: Kotlin 클린 코드
load: always
---

## Kotlin 클린 코드

기존 프로젝트 관례 · 포매터 설정이 먼저다. 형식은 repo 의 포매터(ktlint · spotless 등, `.editorconfig`)에 맡긴다.

### 이름
- 클래스는 명사, 함수는 동사, boolean 은 `is` · `has` · `can`. 약어는 두 글자만 대문자 (`IOStream`), 그 이상은 `HttpClient`.
- `UPPER_SNAKE` 는 상수(`const val`, 깊게 불변인 최상위 · object `val`)만. 백킹 프로퍼티는 `_items`. 테스트 함수는 백틱 문장 이름 허용.

### 함수
- 단일 식이면 식 본문 (`fun total() = items.sumOf { it.price }`). 오버로드 대신 기본 인자, 인자가 여럿이면 호출부에 이름 붙은 인자.
- 싸고 예외 없고 같은 상태면 같은 값을 주는 계산은 함수 대신 프로퍼티.
- 객체를 주로 다루는 도우미는 확장 함수로, 가시성은 좁게.

### 클래스
- `val` 과 읽기 전용 컬렉션(`List`, `listOf`) 기본, `var` · `Mutable*` 은 꼭 필요할 때 안쪽에만.
- 값은 `data class`, 닫힌 경우의 수는 `sealed` + `when` (else 없이), 혼동되는 ID 는 `value class`.
- 공개 라이브러리 코드는 가시성 · 반환 타입을 명시한다.

### 주석 (KDoc)
- 공개 API 에 KDoc. 첫 문단이 요약. `@param` · `@return` 나열보다 본문에서 `[name]` 으로 연결한다.
- 코드가 말하지 못하는 "왜"만. 사용 중단은 `@Deprecated` 애너테이션.

### 읽히는 코드 · 관용구
- `if` · `when` · `try` 를 식으로. 둘이면 `if`, 셋 이상이면 `when`.
- null 은 `?.` · `?:` · `?: return` · `?: throw` 로 입구에서 정리한다. 전제 조건은 `require` · `check` · `error`.
- 스코프 함수는 목적대로: 설정 `apply`, 부수효과 `also`, null 아닐 때 변환 `?.let`, 묶음 호출 `with`.
- `use` 로 자원 닫기. `buildList` · `associateBy` · `groupBy` 등 표준 함수를 먼저 찾는다. 단순 순회는 `for`.

### 하지 않는 것
- 스코프 함수 중첩 · 긴 체인, `it` 이 겹치는 중첩 람다.
- `!!` (불가피하면 이유 주석), 플랫폼 타입을 검사 없이 넘기기.
- `lateinit` 남용, `Unit` 반환 명시, 세미콜론, 상태를 바꾸는 함수를 `infix` 로.
