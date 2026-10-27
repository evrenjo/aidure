---
title: Flutter 구조 · 위젯
load: always
---

## Flutter 구조 · 위젯

기존 상태 관리 · 폴더 구조가 먼저다.

### 구조
- UI 층(View + ViewModel)과 데이터 층(Repository + Service)을 나눈다. View 와 ViewModel 은 1:1.
- 이름은 역할로: `LoginScreen` · `LoginViewModel` · `UserRepository` · `ApiClient`.
- Repository 는 추상 클래스로, 의존성은 주입한다 (전역 싱글턴 금지). 모델은 불변.
- 새 상태 관리 도구를 들이지 않는다. 없으면 `ChangeNotifier` + `ListenableBuilder`.

### 위젯
- 위젯에는 표시 · 숨김, 레이아웃, 애니메이션, 단순 이동만. 업무 로직은 ViewModel 로.
- `build()` 가 길면 작은 위젯 클래스로 나눈다. `Widget _buildX()` 메서드 대신 `StatelessWidget`.
- `const` 생성자를 쓸 수 있으면 쓴다. 생성자 인자는 `super.key` 를 포함한 이름 인자.
- `setState` 는 바뀌는 부분 가까이에. 무거운 일은 `build()` 밖에서. 긴 목록은 `ListView.builder`.
- 콜백 인자는 `onX`, 처리 메서드는 `_handleX`. `dispose()` 에서 컨트롤러 · 구독을 정리하고, `await` 뒤 `context` 를 쓰기 전에 `mounted` 를 확인한다.
