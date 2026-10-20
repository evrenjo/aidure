---
title: Spring 기존 관례 찾기·입력 검증
load: on-demand
when: Spring 에서 엔드포인트를 새로 만들거나 요청·응답·예외·검증·사용자 메시지를 정하거나 바꿀 때
---

원칙은 backend 팩 「백엔드 API 계약·검증·오류 메시지」 — **새 봉투·코드 체계·예외 계층을 만들지 않고 기존 것을 따른다.** 여기는 Spring 앱에서 그 기존 것을 찾는 곳과 Spring 검증 규칙이다.

## 기존 관례를 찾는 곳

| 알아낼 것 | 찾는 방법 |
|---|---|
| 오류 응답 형식·예외 → 상태 매핑 | `grep -rn "@RestControllerAdvice\|@ControllerAdvice\|@ExceptionHandler"` — 여러 개면 `@Order` 로 우선순위 확인 |
| 성공 응답 형식 | 기존 `@RestController` 메서드의 반환 타입 — 공통 래퍼 클래스인지, `ResponseEntity<T>` 인지, DTO 그대로인지 |
| 업무 거부용 예외 | 어드바이스가 400/409 로 바꾸는 `RuntimeException` 하위 클래스 |
| 404·권한 예외 | 어드바이스의 `EntityNotFoundException`·`AccessDeniedException` 처리, `security` 패키지의 커스텀 예외 |
| 사용자 메시지 | `src/main/resources/messages*.properties`, `MessageSource` 를 감싼 유틸·호출부, 키 형식 |
| 검증 메시지 | `@NotBlank(message = …)` 가 키(`"{…}"`)인지 평문인지, `ValidationMessages*.properties` 유무 |
| 페이지 번호 | `spring.data.web.pageable.one-indexed-parameters`, `@PageableDefault` |

찾은 결과(파일 경로)를 작업 보고에 적는다. 도메인마다 다르면 가장 많이 쓰인 쪽을 따르고 그 사실을 알린다.
관례가 전혀 없는 신규 프로젝트일 때만 `packs/stack-spring/docs/example-api-spec.md` 를 **참고안**으로 제시하고 사람이 고른 뒤 적용한다.

## 입력 검증 (Bean Validation)

- 요청 본문 `@Valid @RequestBody *Form`, GET 조건이 여럿이면 `@Valid @ModelAttribute *SearchForm`. 경로 변수 제약은 컨트롤러에 `@Validated`.
- **문자열 필드는 컬럼 길이만큼 `@Size(max = n)`**, 숫자는 `@Digits(integer, fraction)` 을 엔티티 `@Column(length / precision, scale)` 과 맞춘다 — 없으면 초과 입력이 DB `value too long` 으로 **500** 이 된다. 생성·수정 폼 양쪽에 같은 제약.
- 제약의 `message` 는 프로젝트 방식(메시지 키 또는 기본 메시지)을 그대로 따른다.
- 서비스 안에서 입력칸 오류를 모았으면 프로젝트가 그 용도로 쓰는 **런타임** 예외로 던진다 — `BindException`(checked)을 직접 던지면 롤백되지 않는다. 검사: `node packs/stack-spring/bin/check-logging-convention.js`.
- 사용자 메시지에 식별자 숫자를 넘길 때 `String.valueOf` — `MessageFormat` 이 정수를 `202,601` 처럼 찍는다.

## 새 엔드포인트 체크 (Spring)

- [ ] 반환 타입·예외가 기존 컨트롤러·어드바이스와 같은 방식이다
- [ ] `*Form` 에 제약 + 컬럼 길이 `@Size`/`@Digits`, 생성·수정 대칭
- [ ] 새 예외 종류가 필요하면 어드바이스가 그것을 이미 처리하는지 확인했다 (안 하면 500 이 된다)
- [ ] 응답 DTO 에 Swagger `@Schema` 를 쓰는 프로젝트면 달았다
