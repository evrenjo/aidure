# Java 코딩 규약 (stack-spring)

Google Java Style 기반. 포매팅(들여쓰기·공백·import 정렬)은 **Spotless + Google Java Format** 이 맡으므로,
여기는 포매터가 다루지 않는 **명명·주석·선언 순서**만 적는다.

## 1. 파일

- UTF-8, 파일당 top-level 클래스 1개, 클래스명 = 파일명.
- **와일드카드 import 금지** (`java.util.*` ✗). 미사용 import 제거는 포매터가 한다.
- package 문은 줄바꿈하지 않는다.

## 2. 명명

| 대상 | 규칙 | 예 |
|---|---|---|
| 패키지 | 소문자, 구분자 없음 | `com.example.app.service.order` |
| 클래스 | UpperCamelCase + 역할 접미사 | 아래 표 |
| 메서드 | lowerCamelCase, 동사로 시작. boolean 은 `is`/`has` | `createOrder`, `isActive` |
| 변수 | lowerCamelCase, **약어 금지**. 한 글자는 람다·루프 인덱스만 | `orderId` (✗ `oid`) |
| 상수 | UPPER_SNAKE_CASE, `static final` 에만 | `MAX_LOGIN_ATTEMPTS` |

| 레이어 | 접미사 |
|---|---|
| Controller | `Api` |
| Service / Repository / QueryDSL / Mapper | `Service` / `Repository` / `Query` / `Mapper` |
| Entity | 없음 |
| DTO / 요청 | `Dto` / `Form` |
| enum | `Type` |
| Config / Exception / Advice / Filter | `Config` / `Exception` / `Advice` / `Filter` |

엔티티(JPA)는 필드·컬럼 모두 **풀네임** — Java `descriptionContent` ↔ `@Column(name = "description_content")`.

## 3. 상수는 값의 소유자에 둔다

| 값의 성격 | 위치 |
|---|---|
| 코드 전체가 공유하는 도메인 규약 (고정 코드값·버전 순서·금액 scale) | `constant` 패키지의 상수 클래스 (`final` + private 생성자, 복수형 이름) |
| 그 클래스 안에서만 의미가 닫히는 값 | 그 클래스의 `private static final` |
| 여러 배치가 공유하는 튜닝값 (fetch size 등) | 튜닝 상수 클래스 |

- 파일마다 같은 값을 재선언하지 않는다.
- **같은 이름이라도 값이 다르면 다른 상수다** — 공용으로 올리기 전에 선언 전수의 값을 대조한다. 공용으로 올린 뒤 같은 이름의 로컬이 남으면 로컬을 개명한다.
- `BigDecimal` 은 scale 이 다르면 다른 값이다 (`valueOf(100)` ≠ `new BigDecimal("100.00")` — `divide`·`equals` 결과가 다르다).

## 4. 주석

- 분량 상한: 클래스 4줄 / 메서드·필드 2줄 / 로직 1줄. 평문, HTML·Javadoc 태그 없음, `@param/@return/@throws` 없음.
- 애너테이션이 있는 클래스는 첫 애너테이션 **앞**에 Javadoc.
- `TODO(담당자): 내용 (#이슈)` / `FIXME(담당자): …` — 담당자와 이슈 번호를 함께.
- 코드·주석 언어는 workspace.json `vars.language.code` 를 따른다.

## 5. 선언 순서

한 줄에 변수 하나. 클래스 멤버는:

1. `static final` 상수 → 2. `static` 필드 → 3. 인스턴스 필드 → 4. 생성자 → 5. `static` 메서드 → 6. public → 7. protected/package → 8. private

애너테이션 순서:

```java
/** Javadoc */
@RestController                 // 1. 스테레오타입
@RequestMapping("/v1/orders")   // 2. 라우팅
@RequiredArgsConstructor        // 3. Lombok
@Transactional(readOnly = true) // 4. 트랜잭션
@Slf4j                          // 5. 로깅
public class OrderApi {

@Override @Transactional @GetMapping("/{id}")   // 메서드: Override → 트랜잭션 → 매핑

@NotBlank                                      // 필드: 검증 → Swagger (message 는 프로젝트 방식)
@Schema(description = "Order title")
private String orderTitle;
```

## 6. 포매팅

```bash
./gradlew spotlessApply   # 적용
./gradlew spotlessCheck   # 검사 (pre-commit 이 부른다)
```

`spotlessApply` 뒤의 diff 를 "포맷 변경뿐" 이라고 단정하지 않는다 — 커밋 전에 diff 를 본다.
