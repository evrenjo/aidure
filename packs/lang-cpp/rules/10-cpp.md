---
title: C++ 클린 코드
load: always
---

## C++ 클린 코드

먼저 이 repo 의 관례(Google · LLVM · 사내 규칙)와 `.clang-format` · `.clang-tidy` · 표준 버전(`CMAKE_CXX_STANDARD` · `-std=`)을 따른다. 아래는 관례가 없을 때의 기본값(C++ Core Guidelines)이다.

- **이름:** 타입은 `PascalCase`, 함수 · 변수는 repo 관례 하나로 통일 (`.clang-tidy` 의 `readability-identifier-naming` 이 있으면 그것). 함수는 동사, `bool` 은 `is_` · `has_`. 헝가리안 금지.
- **함수:** 한 가지 일, 짧게. 입력은 값(작은 타입) 또는 `const&`, 출력은 반환값 (여럿이면 struct). 같은 타입 인자가 줄줄이면 강한 타입 · struct 로.
- **클래스:** 불변식이 있으면 `class`, 없으면 `struct`. 기본 연산은 정의하지 않는다 (rule of zero), 하나라도 쓰면 다섯 개 모두. 인자 하나 생성자는 `explicit`. 의미 없는 getter · setter 를 만들지 않는다.
- **소유권:** 자원은 RAII 로. `new` · `delete` 를 직접 쓰지 않는다 (`make_unique`). 소유는 `unique_ptr`, 공유가 필요할 때만 `shared_ptr`. 맨 포인터 · 참조는 소유하지 않는다. 연속 데이터는 `span` · `string_view` 로 넘긴다.
- **const · constexpr:** 바뀌지 않으면 `const`, 컴파일 시간 값은 `constexpr`. 멤버 함수도 `const` 를 붙인다.
- **주석:** 무엇 · 왜 만. 공개 API 는 Doxygen 으로 전제 · 소유권 · 예외를 적는다.
- **읽히는 코드:** 이른 반환, `return` 뒤 `else` 금지. 범위 `for` · 표준 알고리즘 · `enum class` · 이름 있는 상수. `auto` 는 타입이 뻔하거나 길 때만.
- **오류:** repo 방식(예외 · `expected` · 오류 코드) 하나만 쓴다. 예외를 쓰면 실패 전용, 값으로 던지고 참조로 받는다. 못 던지는 함수는 `noexcept`, 무시하면 안 되는 반환은 `[[nodiscard]]`.
- **헤더:** include guard 또는 `#pragma once`, 헤더에 `using namespace` 금지, 파일 전용은 익명 namespace.
- **하지 않는 것:** C 스타일 캐스트 (`static_cast` 등 이름 있는 캐스트만), 초기화 안 된 변수, 좁히는 변환, 전역 가변 상태, 경고 끄기, 빌드 설정보다 새 표준 기능.
- 수정 뒤 `clang-tidy` 가 설정돼 있으면 돌리고, 테스트 빌드가 있으면 ASan · UBSan 으로 돌린다.
