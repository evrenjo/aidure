# API 명세 예시 (stack-spring)

> ⚠️ **표준이 없는 신규 프로젝트에서 참고할 수 있는 예시 — 기존 프로젝트에 강요하지 않는다.**
> 이미 응답·오류 형식이 있는 프로젝트는 그것을 따른다(backend 팩 「백엔드 API 계약·검증·오류 메시지」).
> 신규 프로젝트라도 이 안을 그대로 적용하지 말고 사람에게 제시해 고르게 한 뒤, 정한 내용은 project 팩 룰로 옮긴다.
> 아래의 `ApiResponse` · `BusinessException` · `FieldValidationException` · `MessageUtils` 는 예시 이름이다.

## 1. 공통 규칙

| 항목 | 규칙 |
|---|---|
| 필드 이름 | **camelCase** (DB 가 snake_case 여도 응답은 camelCase) |
| 날짜 | `yyyy-MM-dd` |
| 날짜+시간 | `yyyy-MM-dd'T'HH:mm:ss.SSS` (밀리초 포함, ISO 8601) |
| null | Jackson `NON_NULL` — null 필드는 응답에서 제외. 단 목록 `list` 는 빈 배열 `[]` |
| enum | 코드 문자열 (`"ACTIVE"`). 표시 라벨이 필요하면 코드 조회 API 로 |

## 2. 응답 봉투

모든 API 가 같은 봉투를 쓴다. HTTP 상태는 `code` 의 상태와 일치한다.

```json
// 단건
{ "code": "S-200-01", "timestamp": "2026-02-15T14:30:00.000", "message": "OK", "data": { "orderId": "…" } }

// 목록
{ "code": "S-200-01", "timestamp": "…", "message": "OK",
  "data": { "list": [ … ], "pagination": { "totalCount": 25, "currentPage": 1, "pageSize": 10, "totalPages": 3 } } }

// 데이터 없는 완료 — data 키 자체를 생략
{ "code": "S-200-03", "timestamp": "…", "message": "Deleted" }

// 대량 작업 — 부분 실패도 성공 응답 + 실패 목록
{ "code": "S-200-03", "timestamp": "…", "message": "2 deleted, 1 failed",
  "data": { "successCount": 2, "failCount": 1, "failed": [ { "id": "…", "reason": "No permission" } ] } }

// 검증 실패 — errors 는 data 밖
{ "code": "E-400-01", "timestamp": "…", "message": "Check your input.", "traceId": "6a3f7d2e1b4c8a9f",
  "errors": [ { "field": "name", "message": "Name is required." } ] }

// 오류
{ "code": "E-500-01", "timestamp": "…", "message": "Internal error.", "traceId": "6a3f7d2e1b4c8a9f" }
```

- `traceId` 는 **오류 응답에만**. 사용자가 전달하면 백엔드 로그를 바로 찾는다.
- 대량 작업은 전체 실패여도 `E-*` 가 아니라 성공 응답 + `failCount`/`failed` 로 돌려준다.

| 필드 | 설명 |
|---|---|
| `code` | `S-{status}-{순번}` 또는 `E-{status}-{순번}` |
| `message` | 결과 메시지 (다국어 대상) |
| `data` | 도메인 데이터. void 면 키 생략 |
| `traceId` | 요청 추적 ID (오류만) |
| `errors[]` | `{ field, message }` — 검증 실패(`E-400-01`)에만 |
| `pagination` | `totalCount` · `currentPage`(1부터) · `pageSize` · `totalPages` |
| `failed[]` | `{ id, reason }` — reason 은 다국어 대상 |

## 3. 응답 코드

| 코드 | HTTP | 뜻 |
|---|---|---|
| `S-200-01` | 200 | 조회 |
| `S-200-02` | 200 | 수정 완료 |
| `S-200-03` | 200 | 삭제 완료 |
| `S-201-01` | 201 | 생성 완료 |
| `E-400-01` | 400 | 입력 검증 실패 (`errors[]`) |
| `E-400-02` | 400 | 비즈니스 거부 (`BusinessException`) · 본문 파싱 실패 |
| `E-401-01` | 401 | 인증 실패 |
| `E-401-02` | 401 | 토큰 만료 (자동 갱신 후 재시도) |
| `E-401-03` | 401 | 세션 만료/해지 |
| `E-403-01` | 403 | 페이지 접근 권한 없음 |
| `E-403-02` | 403 | API 요청 권한 없음 |
| `E-404-01` | 404 | 데이터·URL 없음 (경로 변수 형식 오류 포함) |
| `E-405-01` | 405 | 허용되지 않은 메서드 (+ `Allow` 헤더) |
| `E-406-01` | 406 | Accept 협상 불가 |
| `E-409-01` | 409 | 중복·충돌 |
| `E-409-03` | 409 | 동시 수정 충돌 (낙관적 잠금) — 화면이 다르게 처리해야 하면 순번을 나눈다 |
| `E-413-01` | 413 | 업로드 용량 초과 (한도 안내 포함) |
| `E-415-01` | 415 | 요청 Content-Type 미지원 |
| `E-429-01` | 429 | 요청 남발 차단 |
| `E-500-01` | 500 | 정의하지 않은 모든 오류 |

- 같은 상태에서 화면이 **구분해야 하는** 경우만 순번을 늘린다 (예: 이메일 중복과 ID 중복을 다른 필드에 표시).
- 잘못된 메서드·Content-Type·업로드 초과가 catch-all 로 떨어져 **500 + ERROR 스택**이 되지 않게 전용 핸들러를 둔다.
- 코드는 `ErrorCode` enum 한 곳에서 정의하고 문자열 리터럴로 흩어 쓰지 않는다.

## 4. 요청 규칙

| 메서드 | URL | 뜻 |
|---|---|---|
| `GET` | `/orders` · `/orders/{id}` | 목록 · 단건 |
| `POST` | `/orders` | 등록 |
| `PUT` | `/orders/{id}` | 전체 교체 (모든 필드) |
| `PATCH` | `/orders/{id}` · `/orders/{id}/status` | 부분 수정 (상태 토글·단일 필드) |
| `DELETE` | `/orders/{id}` · `/orders` (본문에 ID 목록) | 삭제 · 대량 삭제 |

- 복수형 명사 + kebab-case. 동사·camelCase·snake_case 금지 (`/getOrders`, `/orders/delete/{id}` ✗).
- 계층은 2~3단계까지. 더 깊으면 쿼리 파라미터로 (`/lines?orderId=…&itemId=…`).
- GET 은 항상 쿼리 파라미터. 조건 3개 이상이면 `@Valid @ModelAttribute *SearchForm`. 나머지는 `@Valid @RequestBody *Form`.
- 페이지: `?page=1&size=20&sort=createdAt,desc` — 1부터(`spring.data.web.pageable.one-indexed-parameters: true`). 기본 size 는 `@PageableDefault` 로.

## 5. 파일

- **업로드**: `multipart/form-data`, `@RequestPart("file") MultipartFile`. 첨부는 공통 업로드 API 로 먼저 올려 그룹 ID 를 받고, 소유 엔티티 요청은 그 ID 를 JSON 으로 싣는 패턴을 권장한다 (파일과 데이터를 한 요청에 섞지 않는다).
- **다운로드**: 봉투를 쓰지 않는다. `ResponseEntity<StreamingResponseBody>` + `Content-Disposition`. 작은 고정 템플릿만 `byte[]`.
- 없는 첨부 ID 는 봉투 JSON `E-404-01`, 등록은 됐는데 저장소에 파일이 없으면 본문 없는 `204`.

## 6. 인증·다국어

- `Authorization: Bearer <token>`. 인증 실패 `E-401-*`, 권한 부족 `E-403-*`.
- `Accept-Language` 로 메시지 언어를 고른다 (없으면 서버 기본 로케일). `MessageSource` + `messages_{locale}.properties`.
- 다국어 대상: `message`, `errors[].message`, `failed[].reason`, 예외 메시지.

## 7. 컨트롤러 패턴

```java
@RestController
@RequestMapping(value = "/orders/v1/orders", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class OrderApi {
  private final OrderService orderService;

  @GetMapping
  public ApiResponse<ListData<OrderDto>> pageOrder(@Valid @ModelAttribute OrderSearchForm form, Pageable pageable) {
    return ApiResponse.list(orderService.getPage(form, pageable));
  }

  @GetMapping("/{id}")
  public ApiResponse<OrderDto> findOrder(@PathVariable UUID id) {
    return ApiResponse.ok(orderService.getDetail(id));
  }

  @PostMapping
  public ApiResponse<UUID> createOrder(@Valid @RequestBody OrderCreateForm form) {
    return ApiResponse.created(orderService.create(form));
  }

  @PutMapping("/{id}")
  public ApiResponse<UUID> modifyOrder(@PathVariable UUID id, @Valid @RequestBody OrderModifyForm form) {
    return ApiResponse.modified(orderService.modify(id, form));
  }

  @DeleteMapping("/{id}")
  public ApiResponse<Void> deleteOrder(@PathVariable UUID id) {
    orderService.delete(id);
    return ApiResponse.deleted();
  }
}
```

- 오류는 컨트롤러가 신경 쓰지 않는다 — 전역 `@RestControllerAdvice` 가 예외 → 봉투로 바꾼다. 인증 예외·404 처럼 먼저 잡아야 하는 것은 `@Order` 를 높인 별도 어드바이스로.
- 응답 메시지도 키로: `ApiResponse.ok(dto, MessageUtils.getMessage("success.ok"))` 형태를 프로젝트가 쓰면 그대로 따른다.

## 8. 프론트 분기 가이드

```
HTTP 2xx → data.list 있으면 목록 / data.failCount > 0 이면 부분 실패 표시 / data 없으면 message 만
HTTP 4xx·5xx → errors 있으면 필드별 인라인 / 없으면 message / traceId 는 오류 신고에 첨부
```
