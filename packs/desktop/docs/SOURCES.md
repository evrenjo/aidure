# desktop 팩 — 근거 출처

desktop 레이어 룰(`packs/desktop/rules/`)이 기대는 공개 자료다. 룰에 넣은 규칙은 여기 자료에서 왔다.
프로젝트의 기존 관례가 있으면 그것이 먼저이고, 이 목록은 관례가 없을 때의 기준선이다. (조사일 2026-09-29)
룰 번호는 파일 앞 숫자다 — `10` 기본 원칙(always), `20` 웹 기술 셸, `30` 네이티브 툴킷, `40` 패키징·배포.

## 룰별 근거

### `10` 데스크톱 앱 기본 원칙

| 항목 | 근거 |
|---|---|
| 프로젝트의 기존 구조를 따른다 | 킷 규칙(`AGENTS.md` 1) — 관례를 표준처럼 강요하지 않는다 |
| UI 는 UI 스레드에서만, UI 스레드에서 기다리지 않는다 | WPF Threading Model · WinForms cross-thread · Avalonia UI thread · JavaFX `Platform.runLater` · Swing EDT · Qt Threads and QObjects |
| 화면과 로컬 권한 사이는 좁은 IPC 경계 | Electron Security 17·20, Electron Process Model(preload·context isolation), Tauri Security(trust boundary)·Isolation pattern |
| 원격 콘텐츠에 로컬 권한을 주지 않는다 · 외부 링크 스킴 확인 | Electron Security 1·2·13·14·15 |
| 서명·업데이트 무결성 | Electron Code Signing · Electron Updates · Tauri Updater · Apple Notarizing · Microsoft Authenticode time stamping |
| 경로는 OS API 로 | Windows Known Folders · Apple File System Programming Guide · XDG Base Directory |
| 비밀은 OS 자격 증명 저장소에, 대체 동작 확인 | Electron safeStorage(Linux `basic_text` 대체) · Windows DPAPI · Apple Keychain Services · freedesktop Secret Service · OWASP Desktop App Security Top 10(DA3·DA4) |
| 크래시·로그에 개인정보를 싣지 않는다 | Electron crashReporter(업로드 매개변수·저장 위치) · OWASP Desktop App Security Top 10(DA3 민감정보 노출) |
| 키보드·보조기기·고해상도 | Windows UI Automation · AppKit Accessibility · AT-SPI2 · Windows High DPI(Per-Monitor V2) |
| 한 OS 만 확인했으면 적는다 | 위 경로·자격 증명·DPI 자료가 OS 마다 다른 동작을 기술 |

### `20` 웹 기술 셸

Electron 공식 보안 체크리스트 20개 항목을 룰에 옮긴 대응표다.

| # | Electron 체크리스트 | `20` 에서 |
|---|---|---|
| 1 | Only load secure content | 창·웹뷰 설정 표 "로드하는 콘텐츠" |
| 2 | Do not enable Node.js integration for remote content | 표 "Node·네이티브 API 직접 접근 끔" |
| 3 | Enable Context Isolation | 표 "컨텍스트 격리 켬" (끄면 샌드박스도 꺼진다는 주석) |
| 4 | Enable process sandboxing | 표 "렌더러 샌드박스 켬" |
| 5 | Handle session permission requests from remote content | CSP·내비게이션 절 "권한 요청 처리기 기본 거부" |
| 6 | Do not disable `webSecurity` | 표 "웹 보안 기본값 유지" |
| 7 | Define a Content Security Policy | CSP 절 |
| 8 | Do not enable `allowRunningInsecureContent` | 표 "안전하지 않은(HTTP) 콘텐츠 허용 기본값 유지" |
| 9 | Do not enable experimental features | 표 "실험 기능 기본값 유지" |
| 10 | Do not use `enableBlinkFeatures` | 표 "블링크 기능 추가 기본값 유지" |
| 11 | `<webview>`: Do not use `allowpopups` | 표 "임베드 웹뷰 태그 — 팝업 허용을 켜지 않는다" |
| 12 | `<webview>`: Verify options and params | 표 "생성 직전에 옵션을 검사해 강제" |
| 13 | Disable or limit navigation | 내비게이션 절 |
| 14 | Disable or limit creation of new windows | 내비게이션 절 "새 창 생성 처리기" |
| 15 | Do not use `shell.openExternal` with untrusted content | "외부 열기 API 에 신뢰할 수 없는 값을 넘기지 않는다" |
| 16 | Use a current version of Electron | 셸 런타임 절 "지원되는 최신 계열" |
| 17 | Validate the `sender` of all IPC messages | 브리지·IPC 절 "보낸 프레임·출처 확인" |
| 18 | Avoid usage of the `file://` protocol and prefer usage of custom protocols | 표 "`file://` 대신 커스텀 프로토콜" |
| 19 | Check which fuses you can change | 셸 런타임 절 "빌드 퓨즈" (runAsNode·nodeOptions·nodeCliInspect 끔, embeddedAsarIntegrityValidation·onlyLoadAppFromAsar 켬) |
| 20 | Do not expose Electron APIs to untrusted web content | 브리지·IPC 절 "셸 API 객체 자체를 넘기지 않는다" |

Tauri v2 에서 옮긴 것:

| Tauri 문서 | `20` 에서 |
|---|---|
| Security overview — Rust 코어와 WebView 사이 신뢰 경계 | "프로세스 경계부터 확인한다" |
| Capabilities — 여러 capability 에 속한 창은 권한이 합쳐진다 | "한 창이 여러 권한 묶음에 속하면 권한이 합쳐진다" |
| Capabilities — `capabilities/` 의 파일은 기본으로 모두 켜지고, 설정에 명시하면 그 목록만 쓴다 | "자동으로 모두 켜지는 셸 … 어느 방식인지 먼저 본다" |
| Capabilities — `remote.urls`, Linux·Android 는 iframe 과 창을 구분하지 못한다 | "원격 URL 에 명령 접근을 여는 설정은 쓰지 않는 게 기본" |
| Capabilities — `platforms` 로 대상 제한 | "플랫폼별 권한은 플랫폼 조건으로 좁힌다" |
| Permissions·Scopes — 명령 단위 허용과 세부 범위 | "가장 좁은 범위로 … 와일드카드를 넓히지 않는다" |
| Isolation pattern — 프런트 메시지를 코어 전에 가로채 검사 | "격리 계층이 있는지 보고 우회하지 않는다" |
| CSP — 로컬 스크립트는 해시, 스타일·외부 스크립트는 nonce 자동 주입 / CDN 원격 스크립트 피하기 / WebAssembly 는 `'wasm-unsafe-eval'` | CSP 절 |

### `30` 네이티브 툴킷 — UI 스레드·화면 구조

| 항목 | 근거 |
|---|---|
| UI 객체는 만든 스레드에서만 (WPF `DispatcherObject.VerifyAccess`, `Dispatcher.InvokeAsync`) | WPF Threading Model |
| WinForms `Invoke`/`BeginInvoke` | WinForms — How to handle cross-thread operations with controls |
| Avalonia "모든 UI 상호작용은 UI 스레드에서", `Dispatcher.UIThread` | Avalonia — Accessing the UI thread |
| JavaFX `Platform.runLater`, 대기 Runnable 을 넘치게 쌓지 말고 묶어 보내라 · 백그라운드는 `javafx.concurrent.Task` | JavaFX `Platform` API · `javafx.concurrent.Task` |
| MAUI `MainThread.BeginInvokeOnMainThread` | .NET MAUI — Main thread |
| Swing 백그라운드 `SwingWorker` | `javax.swing.SwingWorker` API |
| Swing 컴포넌트 메서드는 EDT 에서, EDT 작업은 짧게 | Oracle Swing tutorial — The Event Dispatch Thread |
| Qt `QWidget` 은 메인 스레드 전용, 큐드 연결, `moveToThread`, `deleteLater`, 부모·자식 같은 스레드 | Qt — Threads and QObjects |
| MVVM — 뷰는 뷰모델을, 뷰모델은 모델을 알고 역방향은 모른다 | Microsoft — MVVM (Enterprise Application Patterns using .NET MAUI) |
| 플랫폼 접근성 API 노출 | Windows UI Automation · AppKit Accessibility · AT-SPI2 |
| 논리 단위·모니터별 DPI(PMv2 권장) | Windows High DPI Desktop Application Development |
| `ApplicationHighDpiMode` 등 프로젝트 설정 | .NET Desktop SDK MSBuild properties |

### `40` 패키징·배포

| 항목 | 근거 |
|---|---|
| 서명하지 않은 앱은 Windows·macOS 가 막거나 경고 | Electron Code Signing |
| macOS: 하드닝된 런타임·보안 타임스탬프·공증·스테이플, 디스크 이미지·설치 패키지도 공증 대상 | Apple — Notarizing macOS software before distribution · Hardened Runtime |
| Windows: 타임스탬프가 없으면 인증서 만료 시 서명이 무효 | Microsoft — Time Stamping Authenticode Signatures · SignTool |
| Windows: 패키지 서명은 배포 필수 단계 | Microsoft — Sign an MSIX package |
| Windows: 서명·인증서 평판에 따른 경고 | Microsoft Defender SmartScreen |
| 클라우드 서명 서비스 | Microsoft — Artifact Signing overview · Electron Code Signing |
| Linux 샌드박스 권한 최소·포털·권한은 정적 | Flatpak — Sandbox permissions |
| 업데이트 서명 검증은 끌 수 없다 | Tauri Updater ("This cannot be disabled") |
| macOS 업데이트는 앱 서명이 있어야 동작 | Electron Code Signing (Squirrel.Mac) · Electron Updates |
| 업데이트 검사는 패키징된 앱에서만 | Electron Updates |
| 사용자 위치 경로 | Windows Known Folders · Apple File System Programming Guide · XDG Base Directory |

## 자료 목록

### 웹 기술 셸

| 자료 | URL |
|---|---|
| Electron, Security (checklist) | https://www.electronjs.org/docs/latest/tutorial/security |
| Electron, Context Isolation | https://www.electronjs.org/docs/latest/tutorial/context-isolation |
| Electron, Process Sandboxing | https://www.electronjs.org/docs/latest/tutorial/sandbox |
| Electron, Process Model | https://www.electronjs.org/docs/latest/tutorial/process-model |
| Electron, Electron Fuses | https://www.electronjs.org/docs/latest/tutorial/fuses |
| Electron, safeStorage | https://www.electronjs.org/docs/latest/api/safe-storage |
| Electron, crashReporter | https://www.electronjs.org/docs/latest/api/crash-reporter |
| Electron, Code Signing | https://www.electronjs.org/docs/latest/tutorial/code-signing |
| Electron, Updating Applications | https://www.electronjs.org/docs/latest/tutorial/updates |
| Tauri v2, Security | https://v2.tauri.app/security/ |
| Tauri v2, Capabilities | https://v2.tauri.app/security/capabilities/ |
| Tauri v2, Content Security Policy | https://v2.tauri.app/security/csp/ |
| Tauri v2, Isolation Pattern | https://v2.tauri.app/concept/inter-process-communication/isolation/ |
| Tauri v2, Updater | https://v2.tauri.app/plugin/updater/ |
| Tauri v2, macOS Code Signing | https://v2.tauri.app/distribute/sign/macos/ |

### 네이티브 툴킷

| 자료 | URL |
|---|---|
| Microsoft, WPF Threading Model | https://learn.microsoft.com/en-us/dotnet/desktop/wpf/advanced/threading-model |
| Microsoft, WinForms cross-thread operations | https://learn.microsoft.com/en-us/dotnet/desktop/winforms/controls/how-to-make-thread-safe-calls |
| Microsoft, MSBuild properties for Microsoft.NET.Sdk.Desktop | https://learn.microsoft.com/en-us/dotnet/core/project-sdk/msbuild-props-desktop |
| Microsoft, MVVM (Enterprise Application Patterns using .NET MAUI) | https://learn.microsoft.com/en-us/dotnet/architecture/maui/mvvm |
| Avalonia, Accessing the UI thread | https://docs.avaloniaui.net/docs/guides/development-guides/accessing-the-ui-thread |
| OpenJFX, `javafx.application.Platform` | https://openjfx.io/javadoc/21/javafx.graphics/javafx/application/Platform.html |
| Oracle, Swing — The Event Dispatch Thread | https://docs.oracle.com/javase/tutorial/uiswing/concurrency/dispatch.html |
| Qt 6, Threads and QObjects | https://doc.qt.io/qt-6/threads-qobject.html |
| OpenJFX, `javafx.concurrent.Task` | https://openjfx.io/javadoc/21/javafx.graphics/javafx/concurrent/Task.html |
| Microsoft, .NET MAUI Main thread | https://learn.microsoft.com/en-us/dotnet/maui/platform-integration/appmodel/main-thread |
| Oracle, `javax.swing.SwingWorker` | https://docs.oracle.com/javase/8/docs/api/javax/swing/SwingWorker.html |

### 배포·서명·OS

| 자료 | URL |
|---|---|
| Apple, Notarizing macOS software before distribution | https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution |
| Apple, Hardened Runtime | https://developer.apple.com/documentation/security/hardened-runtime |
| Microsoft, Time Stamping Authenticode Signatures | https://learn.microsoft.com/en-us/windows/win32/seccrypto/time-stamping-authenticode-signatures |
| Microsoft, SignTool | https://learn.microsoft.com/en-us/windows/win32/seccrypto/signtool |
| Microsoft, Sign an MSIX package | https://learn.microsoft.com/en-us/windows/msix/package/signing-package-overview |
| Microsoft, Defender SmartScreen | https://learn.microsoft.com/en-us/windows/security/operating-system-security/virus-and-threat-protection/microsoft-defender-smartscreen/ |
| Microsoft, Artifact Signing overview | https://learn.microsoft.com/en-us/azure/artifact-signing/overview |
| Flatpak, Sandbox Permissions | https://docs.flatpak.org/en/latest/sandbox-permissions.html |
| Microsoft, Known Folders | https://learn.microsoft.com/en-us/windows/win32/shell/known-folders |
| Apple, File System Programming Guide — File System Basics | https://developer.apple.com/library/archive/documentation/FileManagement/Conceptual/FileSystemProgrammingGuide/FileSystemOverview/FileSystemOverview.html |
| freedesktop, XDG Base Directory Specification | https://specifications.freedesktop.org/basedir-spec/latest/ |
| Microsoft, CryptProtectData (DPAPI) | https://learn.microsoft.com/en-us/windows/win32/api/dpapi/nf-dpapi-cryptprotectdata |
| Apple, Keychain Services | https://developer.apple.com/documentation/security/keychain-services |
| freedesktop, Secret Service API | https://specifications.freedesktop.org/secret-service-spec/latest/ |
| OWASP, Desktop App Security Top 10 | https://owasp.org/www-project-desktop-app-security-top-10/ |

### 접근성·고해상도

| 자료 | URL |
|---|---|
| Microsoft, UI Automation | https://learn.microsoft.com/en-us/windows/win32/winauto/entry-uiauto-win32 |
| Apple, Accessibility for AppKit | https://developer.apple.com/documentation/appkit/accessibility-for-appkit |
| freedesktop, AT-SPI2 | https://www.freedesktop.org/wiki/Accessibility/AT-SPI2/ |
| Microsoft, High DPI Desktop Application Development on Windows | https://learn.microsoft.com/en-us/windows/win32/hidpi/high-dpi-desktop-application-development-on-windows |
