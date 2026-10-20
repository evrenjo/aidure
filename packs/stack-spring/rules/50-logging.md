---
title: Spring 로깅
load: on-demand
when: Spring 백엔드에서 로그를 새로 넣거나, 예외를 잡아 로그로 남기는 코드·@RestControllerAdvice 를 고칠 때
---

원칙(레벨·한 번만 기록·추적 ID·개인정보)은 backend 팩 「백엔드 로깅 원칙」. 여기는 SLF4J 에서의 구체 규칙이다.

- **값은 `{}` placeholder** — `log.info("created: id={}", id)`. `"id=" + id` 연결 금지.
- **예외 객체를 마지막 인자로** — `log.error("fail: id={}", id, e)`. `e.getMessage()` 만 넘기면 스택트레이스가 없다.
- **`printStackTrace()` · `System.out/err` 금지** — `@Slf4j` 로거만.
- **메시지 접두어·로그 헬퍼는 프로젝트 것을 따른다** — 기존 `log.*` 호출 몇 개와 로그 헬퍼 클래스(있으면)를 먼저 본다. 헬퍼가 있으면 `log.*` 를 직접 부르지 않는다.
- 추적 ID 는 보통 필터에서 `MDC` 에 넣고 로그 패턴 `%X{traceId}` 로 찍는다 — 이미 있으면 그 키를 쓴다.
- 프레임워크 기본 처리가 400 을 DEBUG 로, 처리 안 된 예외를 WARN 으로 찍는 경우가 있다 — 레벨을 맞추려면 어드바이스에서 직접 기록한다.

## 검사

```bash
node packs/stack-spring/bin/check-logging-convention.js [--code-literal '<오류 코드 정규식>']
```

서비스의 checked `BindException` · `printStackTrace`/`System.out` · 로그 문자열 연결 · (옵션) 오류 코드 문자열 리터럴을 잡고, 예외 객체 없이 `getMessage()` 만 넘긴 `log.error` 는 "확인 필요" 로 보여준다. 로그를 추가·변경했으면 커밋 전에 돌린다.

프로젝트가 접두어 형식을 아직 정하지 않았다면 `packs/stack-spring/docs/example-logging.md` 가 참고안이다(강제 아님).
