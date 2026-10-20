---
title: 네이티브 툴킷: UI 스레드·화면 구조
load: on-demand
when: 네이티브 UI 툴킷(WPF·WinForms·MAUI·Avalonia·JavaFX·Swing·Qt 류) 화면 코드에서 비동기·백그라운드 작업, 타이머, 이벤트·바인딩, 뷰모델·컨트롤러 구조를 추가하거나 바꿀 때
---

## UI 스레드 규칙 (툴킷 공통)

UI 객체는 만든 스레드(UI 스레드)에서만 읽고 쓴다. 다른 스레드에서 만지면 예외가 나거나, 더 나쁘게는 가끔만 깨진다.

| 툴킷 | UI 스레드로 돌려보내는 법 | 백그라운드 수단 예 |
|---|---|---|
| WPF · Avalonia | `Dispatcher` (`InvokeAsync` 등), `await` 후 UI 컨텍스트 복귀 | `Task.Run` |
| WinForms | `Control.Invoke`/`BeginInvoke`, `await` 후 복귀 | `Task.Run` |
| MAUI | `MainThread.BeginInvokeOnMainThread` / Dispatcher | `Task.Run` |
| JavaFX | `Platform.runLater` | `javafx.concurrent.Task`·`Service` |
| Swing | `SwingUtilities.invokeLater` (EDT) | `SwingWorker` |
| Qt | 큐드 시그널·슬롯 연결 (받는 객체의 스레드에서 실행) | `QThread` + `moveToThread`, `QtConcurrent` |

- **UI 스레드에서 블로킹 호출을 하지 않는다** — 동기 I/O, `.Result`·`.Wait()`·`join()`, 긴 루프. 멈춘 창은 OS 가 "응답 없음"으로 표시한다.
- **async 는 끝까지 async** — 이벤트 처리기 외에서 `async void` 를 새로 만들지 않는다. 동기 래핑으로 교착을 만들지 않는다.
- **결과를 UI 로 보낼 때 묶어서 보낸다** — 항목마다 UI 큐에 넣으면 큐가 밀려 멈춘다(툴킷 문서가 공통으로 경고).
- **취소·종료를 처리한다** — 창이 닫힌 뒤 도착한 결과가 사라진 컨트롤을 만지지 않게 취소 토큰·수명 확인을 둔다.
- Qt: `QWidget` 계열은 메인 스레드 전용. 다른 스레드 객체 삭제는 `deleteLater`, 부모·자식은 같은 스레드에서.

## 화면 구조

- **프로젝트가 쓰는 분리 방식을 따른다** — MVVM(뷰모델·바인딩·커맨드), MVP, 컨트롤러 등. 새 화면을 기존 방식과 다르게 만들지 않는다.
- 뷰(XAML·FXML·`.ui`·폼 디자이너 파일)에는 표시 로직만. 판정·저장·I/O 는 뷰모델·서비스로.
- **디자이너 생성 파일은 손으로 고치지 않는다** — 디자이너나 원본 정의를 고쳐 다시 생성한다.
- 이벤트 구독은 해제 시점을 정한다(창보다 오래 사는 객체에 구독하면 창이 수거되지 않는다).

## 접근성·고해상도

- 표준 컨트롤을 우선 쓴다 — 플랫폼 접근성 API(Windows UI Automation, macOS NSAccessibility, Linux AT-SPI)에 자동으로 노출된다.
  커스텀 그리기 컨트롤은 그 툴킷의 접근성 속성(이름·역할·상태)을 채운다.
- 탭 순서·단축키·포커스 표시를 확인한다. 색만으로 상태를 구분하지 않는다.
- 크기·좌표는 논리 단위로. DPI 인식 모드(모니터별 등)는 프로젝트 설정을 따르고, 바꾸면 여러 배율 모니터에서 확인한다.
