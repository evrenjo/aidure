---
title: Swift 클린 코드
load: always
---

## Swift 클린 코드

기존 프로젝트 관례 · `.swiftlint.yml` · `.swift-format` 이 먼저다. 형식은 repo 의 포매터(swift-format 또는 SwiftFormat)에 맡긴다.

### 이름
- 부르는 자리에서 영어 문장처럼 읽히게 (`x.insert(y, at: i)`, `list.remove(at: i)`). 타입을 되풀이하는 낱말은 뺀다 (`removeElement` 아님). 이름은 타입이 아니라 역할로.
- 부수 효과 있는 메서드는 동사 (`sort()`), 없는 것은 명사구 (`distance(to:)`). 짝: `sort` / `sorted`, `append` / `appending`.
- Bool 은 단언형 (`isEmpty`, `canSubmit`). 팩토리는 `make…`. 프로토콜은 명사 또는 `-able` · `-ing`.
- 약어를 지어내지 않는다. 흔한 약어는 대소문자를 통째로 (`userID`, `urlString`). 접두사(`k`, 클래스 접두사) 없음.

### 함수 · 인자 레이블
- 첫 인자가 기본 이름과 문장을 이루면 레이블 생략 (`addSubview(_:)`), 전치사구면 전치사부터 (`move(to:)`).
- 메서드 묶음 대신 기본값 인자, 기본값 인자는 뒤로.
- `guard` 로 일찍 빠져 성공 흐름을 왼쪽에 둔다.

### 타입
- 기본은 `struct` · `enum`, 참조 의미가 필요할 때만 `class` (상속 안 하면 `final`). 접근 제어는 가장 좁게.
- 실패 방식이 하나면 `Optional`, 여럿이면 `throws` + 오류 enum. 프로토콜 채택은 extension 으로 나누고 `// MARK: -` 로 묶는다.

### 주석
- 공개 선언은 `///` 한 문장 요약으로 시작한다. `- Parameters:` · `- Returns:` · `- Throws:` 순서, nil 이 되는 경우를 적는다. O(1) 이 아닌 계산 속성은 복잡도를 적는다.

### 동시성
- 빌드 설정의 기본 격리(MainActor 기본인지)를 먼저 본다. UI 코드는 `@MainActor`, 공유 가변 상태는 `actor`, 경계를 넘는 값은 `Sendable`.
- `DispatchQueue` 대신 `async` / `await`, 병렬은 `async let` · `TaskGroup`. `@unchecked Sendable` · `nonisolated(unsafe)` 는 이유 주석 없이 쓰지 않는다.

### SwiftUI
- `body` 가 길면 작은 `View` 로 나눈다. 로직은 `@Observable` 모델로. 소유 상태는 `@State private`, 받은 모델의 바인딩은 `@Bindable`, 공유는 `@Environment`.

### 하지 않는 것
- `!` 강제 언래핑 · `as!` · `try!` (테스트 · 이유 주석 예외), `-1` 같은 표식 값, 불필요한 `self.`.
