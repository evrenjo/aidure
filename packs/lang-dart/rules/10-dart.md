---
title: Dart 클린 코드
load: always
---

## Dart 클린 코드

기존 프로젝트 관례 · `analysis_options.yaml` 이 먼저다. `dart format` 결과를 손으로 고치지 않는다.

### 이름
- 타입 · extension 은 UpperCamelCase, 파일 · 폴더 · import 접두사는 `lower_snake`, 나머지와 상수는 lowerCamelCase (`k` · `SCREAMING` 금지).
- 세 글자 이상 약어는 낱말처럼 (`HttpClient`, `userId`). 약어를 지어내지 않는다.
- 문장처럼 읽히게 (`if (list.isEmpty)`). 가장 뜻이 큰 명사를 끝에 (`pageCount`).
- 부수 효과는 명령형 동사, 값을 돌려주면 명사구. `get` 접두사 금지. 복사는 `toX()`, 보기는 `asX()`. Bool 은 `is` · `has` · `can` 긍정형.

### 함수 · 변수
- 고칠 일이 없으면 `final`, 컴파일 시 값이면 `const`. 계산 가능한 값은 저장하지 않는다.
- 초기값 있는 지역 변수는 타입 생략, 공개 API 의 인자 · 반환은 타입 명시. `dynamic` 은 피한다.
- 위치 bool 인자 대신 이름 있는 인자 (`required`). 람다 대신 tear-off. 간단한 멤버는 `=>`.
- `null` 로 초기화하지 않는다. `== true` 비교 대신 타입 승격 · 패턴으로.

### 타입
- 상태는 불변 우선 (`final` 필드, `copyWith`). `==` 를 고치면 `hashCode` 도.
- 정적 멤버만 있는 클래스 대신 최상위 함수 · 상수. 상속 의도는 `final` · `base` · `interface` · `sealed` 로 밝히고, 경우 나눔은 `sealed` + `switch` (`default` 없이).

### 비동기 · 오류
- `then` 체인 대신 `async` / `await`. 값 없는 비동기는 `Future<void>`.
- `catch` 는 `on 타입` 과 함께. `Error` 는 잡지 않는다. 다시 던질 땐 `rethrow`. 오류를 조용히 버리지 않는다.

### 주석
- 공개 API 는 `///`. 첫 문단은 한 문장 요약 (함수는 3인칭 동사, bool 은 "Whether"). 식별자는 `[name]`. 이름을 되풀이하는 주석은 쓰지 않는다.
- `// ignore:` 에는 이유를 적는다.
