---
title: Java 클린 코드
load: always
---

## Java 클린 코드

기존 프로젝트 관례 · 포매터 설정이 먼저다. 형식(들여쓰기 · 줄 길이 · import 순서)은 포매터(Spotless · google-java-format 등)에 맡긴다.

### 이름
- 클래스는 명사, 메서드는 동사로 시작 (`findActiveOrders`), boolean 은 `is` · `has` · `can`.
- 약어도 한 단어로 (`HttpClient`, `userId`). 한국어 발음 표기 · 접두어(`m`, `str`) · 한 글자 이름(반복 인덱스 제외) 금지.
- `UPPER_SNAKE` 는 깊게 불변인 `static final` 상수만.

### 메서드
- 한 가지 일, 한 단계 추상화. 인자가 많으면 값 객체 · `record` · 빌더로 묶고, boolean 플래그 인자 대신 메서드를 나눈다.
- 컬렉션은 `null` 대신 빈 컬렉션을 반환한다. 없을 수 있는 단건 반환에만 `Optional`.
- 공개 메서드 입구에서 인자를 검증하고(`Objects.requireNonNull` 등) 실패는 표준 예외로.

### 클래스
- 필드는 `private final` 기본, 불변 우선. 값 묶음은 `record`, 닫힌 경우의 수는 `sealed` + `switch` 패턴.
- 접근 범위는 최소로. 상속보다 조합. 같은 이름 오버로드는 붙여 둔다.

### 주석 (Javadoc)
- 공개 API 에 Javadoc. 첫 문장은 요약 (`Returns ...` 처럼 3인칭). 이름을 되풀이만 하는 설명은 쓰지 않는다.
- 코드가 말하지 못하는 "왜"만 주석으로. `TODO` 는 이유와 함께.

### 읽히는 코드 · 관용구
- 조건은 이름 붙은 변수 · 메서드로 (`if (order.isRefundable())`). 이중 부정을 피한다.
- 스트림은 짧은 변환에, 분기 · 부수효과가 많으면 for 문.
- try-with-resources, `List.of` · `Map.of`, `switch` 식, `instanceof` 패턴. `var` 는 오른쪽에서 타입이 보일 때만.
- `@Override` 를 항상 붙인다. `equals` 를 고치면 `hashCode` 도.

### 하지 않는 것
- 예외를 삼키는 빈 `catch` (불가피하면 이유 주석), 흐름 제어용 예외.
- `Optional` 을 필드 · 매개변수 · 컬렉션 원소로 쓰기, `Optional.get()` 맨 호출.
- 와일드카드 import, raw type, 불필요한 형변환.
