---
title: Android 구조 · ViewModel · Compose
load: always
---

## Android 구조 · ViewModel · Compose

기존 프로젝트 구조 · lint 설정이 먼저다.

### 구조
- UI 층(Compose + ViewModel)과 데이터 층(Repository)을 나눈다. 화면 · ViewModel 은 DB · 네트워크를 직접 부르지 않고 Repository 를 거친다.
- 이름은 역할로: `NewsViewModel`, Repository 구현은 `OfflineFirstNewsRepository` (없으면 `Default…`), 가짜는 `Fake…`. 계층 사이는 `Flow`(읽기)와 `suspend`(쓰기), 생성자 주입.

### ViewModel
- 화면당 하나, 화면 단위 composable 에서만 받는다. 하위 composable 에 넘기지 않는다.
- `Context` · `Activity` · `Resources` 를 들지 않는다. `AndroidViewModel` 대신 `ViewModel`.
- 상태는 `StateFlow<XxxUiState>` 하나 (불변 data class 또는 sealed interface). 일회성 이벤트를 UI 로 보내지 않고 상태로 바꾼다.

### Compose
- UI 를 그리는 composable 은 PascalCase 명사, 값을 돌려주는 것은 lowerCamel. 그리기와 반환을 섞지 않는다.
- `modifier: Modifier = Modifier` 를 첫 선택 인자로 두고 최상위 노드에 한 번만. 주 슬롯 `content` 는 마지막, 이벤트는 `onXxx` 람다.
- 상태는 쓰는 곳의 가장 가까운 공통 조상으로 올린다 (stateless 우선). 수집은 `collectAsStateWithLifecycle()`. 인자는 불변 타입으로.
- 기기 테스트(`androidTest`) 함수 이름에 공백(백틱 문장)을 쓰지 않는다.
