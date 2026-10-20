# 로깅 형식 예시 (stack-spring)

> ⚠️ **로그 형식이 아직 없는 프로젝트에서 참고할 수 있는 예시 — 기존 프로젝트에 강요하지 않는다.**
> 원칙은 backend 팩 「백엔드 로깅 원칙」, Spring 구체 규칙은 stack-spring 「Spring 로깅」 룰. 이 문서의 오류 코드는
> `example-api-spec.md` 예시 체계를 가정한다.

로그 플랫폼(수집기)에서 **errorCode / domain / level** 로 필터·집계·알림을 걸 수 있게 백엔드 로그를 표준화한다.
평문 로그를 유지하고 메시지 **맨 앞 접두어**만 약속한다 — 로그 패턴·MDC 를 바꾸지 않아도 수집기가 접두어를 파싱한다.

## 1. 메시지 형식

```
[errorCode][DOMAIN{:subKey}] action: key=value key=value
```

| 칸 | 설명 | 예 |
|---|---|---|
| `errorCode` | 응답 코드 (`packs/stack-spring/docs/example-api-spec.md` §3 예시). **정상 흐름은 생략** | `E-500-01`, `E-400-02` |
| `DOMAIN` | 도메인 enum 값 | `ORDER`, `AUTH`, `SYSTEM` |
| `subKey` | 도메인 안 세부 (선택, `:` 구분) — 배치 잡 이름·인증 세부·기동 단계 | `BATCH:NIGHTLY_SYNC`, `AUTH:ENDPOINT`, `SYSTEM:BOOT` |
| `action` | 짧은 동사구 | `create`, `business`, `uncaught`, `slow` |
| `key=value` | 식별자·수치. 공백 있는 값은 따옴표 | `id=42 total=10` |

```java
// 정상
log.info("[ORDER] create: id={} status={}", orderId, status);
// 비즈니스 거부 (WARN)
log.warn("[E-400-02][ORDER] business: msg={}", e.getMessage());
// 시스템 오류 (ERROR + 예외 객체를 마지막 인자로 → 스택트레이스)
log.error("[E-500-01][SYSTEM] uncaught: msg={}", e.getMessage(), e);
```

수집기 파싱 예(grok): `%{NOTSPACE:errorCode}?\[%{DATA:domain}\] %{GREEDYDATA:message}` — 첫 `[…]` 가 코드일 수도 도메인일 수도 있어 수집기 룰에서 분기한다.

## 2. 도메인·코드 enum

- **`Domain` enum** — `SYSTEM`(500·시스템), `AUTH`, `VALIDATION`(입력 검증), `NOT_FOUND`, `CLIENT`(메서드·미디어 타입 등), `BUSINESS`(도메인 추정 실패 fallback), `PERF`(느린 요청), `EXTERNAL`(외부 연동), `BATCH` + 업무 도메인들. 새 값은 먼저 subKey 로 해결되는지 본다.
- **`ErrorCode` enum** — `CODE("E-{status}-{seq}", HttpStatus.X)` 한 곳에서 정의. 로그·응답 어디서도 `"E-409-01"` 리터럴을 쓰지 않는다. 외부에서 들어온 코드 문자열은 `ErrorCode.fromCode(s).orElse(BUSINESS_ERROR)` 로 변환.
- 새 코드를 추가하면 이 문서·API 명세의 표와 수집기 알림 룰을 함께 갱신한다.

## 3. 레벨

| 레벨 | 언제 | 예 |
|---|---|---|
| ERROR | 시스템 결함 — 코드 버그·외부 장애·정의하지 않은 500 | `[E-500-01][SYSTEM]` |
| WARN | 비즈니스 거부·입력 오류·404 (알림 임계값 기준) | `[E-400-02][ORDER]`, `[E-400-01][VALIDATION]` |
| INFO | 정상 이벤트 — 로그인·생성/수정/삭제 성공·배치 시작/완료 | `[ORDER] create:` |
| DEBUG | 개발 진단 — 운영 비활성 | |

- 프레임워크 기본 핸들러가 400 을 DEBUG, 500 을 WARN 으로 찍으면 전역 로깅 어드바이스로 가로채 WARN/ERROR 로 올린다.
- 서비스 안 입력칸 오류는 런타임 필드 검증 예외로 던져 **WARN** 으로 남긴다 (checked `BindException` 은 ERROR 로 남고 롤백도 안 된다).

## 4. 전역 예외 → 로그 매핑 (기준 모양)

| 예외 | 코드 | 레벨 | DOMAIN |
|---|---|---|---|
| 그 외 `Exception` | E-500-01 | ERROR | SYSTEM |
| 비즈니스 예외 | 예외의 코드 또는 E-400-02 | WARN | 호출 클래스로 추정, 실패 시 BUSINESS |
| `BindException` · 필드 검증 예외 | E-400-01 | WARN | VALIDATION |
| `HttpMessageNotReadableException` | E-400-02 | WARN | VALIDATION |
| 낙관적 잠금 (`ObjectOptimisticLockingFailureException`, JPA `OptimisticLockException`) | E-409-03 | WARN | 추정 |
| `EntityNotFoundException` · `FileNotFoundException` | E-404-01 | WARN | NOT_FOUND |
| 경로 변수 타입 불일치 / 쿼리 파라미터 타입 불일치 | E-404-01 / E-400-01 | WARN | NOT_FOUND / VALIDATION |
| `HttpRequestMethodNotSupportedException` | E-405-01 | WARN | CLIENT |
| `HttpMediaTypeNotSupportedException` | E-415-01 | WARN | CLIENT |
| `HttpMediaTypeNotAcceptableException` | E-406-01 | WARN | CLIENT |
| `MaxUploadSizeExceededException` | E-413-01 | WARN | CLIENT |

- 서비스가 `flush()` 를 직접 부르면 JPA 원형 예외가 번역 없이 올라온다 — 두 형태를 모두 받는다.
- 404 응답 문구는 서비스가 넣은 사용자 문장. UUID·내부 경로·하위 예외 원문은 응답이 아니라 로그로.

## 5. 로그 헬퍼 (권장)

`log.*` 를 직접 부르면 도메인 오타·접두어 누락·코드 리터럴이 생긴다. 프로젝트에 정적 헬퍼를 두고 그것만 쓰게 하면 검사가 쉬워진다.

```java
LogHelper.info(log, Domain.ORDER, "create", "id", orderId, "status", status);
LogHelper.warn(log, Domain.ORDER, ErrorCode.BUSINESS_ERROR, "business", "msg", reason);
LogHelper.errorWith(log, Domain.EXTERNAL, ErrorCode.INTERNAL_SERVER_ERROR, "timeout", e, "elapsedMs", ms);
```

- kv 는 (key, value) 쌍 — 홀수면 즉시 예외. WARN/ERROR 는 `ErrorCode` 필수, INFO/DEBUG 는 없음.
- 예외는 `errorWith*` 로만 넘긴다 (일반 error 에 넘기면 스택이 안 박힌다).
- subKey 변형은 별도 메서드(`infoSub` 등)로 — String varargs 오버로딩은 모호해진다.
- `isXxxEnabled()` 가드를 헬퍼 안에 둔다.

## 6. 개인정보

| 항목 | 정책 |
|---|---|
| 비밀번호·토큰·시크릿·키 | **절대 로깅 금지** (요청 로깅 필터의 민감 키 마스킹 목록에도 등록) |
| 주민번호·카드번호·주소 | 금지 |
| 이메일·전화 | 마스킹 (`a***@***.com`, `010-****-1234`) |
| 사용자 ID(UUID) | 그대로 가능 |

헬퍼로 넘긴 값은 자동 마스킹되지 않는다 — 넘기기 전에 거른다.

## 7. 검사

```bash
node packs/stack-spring/bin/check-logging-convention.js [--root <Java 소스>] [--code-literal 'E-[0-9]+-[0-9]+']
```

| 검사 | 판정 |
|---|---|
| 서비스의 `throws BindException` / `throw new BindException` | 위반 |
| `printStackTrace()` · `System.out/err` | 위반 |
| 로그 메시지 문자열 연결 (여러 줄 호출 포함) | 위반 |
| 오류 코드 문자열 리터럴 (`--code-literal`, enum 정의 파일 제외) | 위반 |
| `log.error(…, e.getMessage())` 로 끝나고 예외 객체 없음 | 확인 필요 |

프로젝트 헬퍼를 의무화했다면 "헬퍼 우회(`log.*` 직접 호출)" 검사를 project 팩 도구로 추가한다.
