# <스키마> 스키마

> 테이블 정의서 견본 (datamodel 팩). 스키마마다 한 파일. 이 파일을 `<스키마>.md` 로 복사해 쓴다.
> 제목 「### <스키마>.<테이블> <논리명>」 아래 설명 줄과 컬럼 표 하나. `aidure docs build` 가 ERD 를, `aidure datamodel check` 가 검사를 한다.

### shop.member 회원
회원 계정. 기능: FN-MEM-001 · FN-MEM-002 · 영역: 회원

| 컬럼 | 논리명 | 타입 | 널 | 키 | 참조 | 설명 |
|---|---|---|---|---|---|---|
| id | ID | bigint | N | PK | | |
| email | 이메일 | varchar(254) | N | UK | | 로그인 ID |
| name | 이름 | varchar(50) | N | | | |
| status | 상태 | varchar(20) | N | | | ACTIVE / LOCKED |
| created_at | 생성 일시 | timestamptz | N | | | |
| updated_at | 수정 일시 | timestamptz | N | | | |

### shop.orders 주문
주문 원장(월 파티션). 기능: FN-ORD-001 · 결정: D-3 · 영역: 주문
파티션: created_at 월 단위 · 보존: 5년

| 컬럼 | 논리명 | 타입 | 널 | 키 | 참조 | 설명 |
|---|---|---|---|---|---|---|
| id | ID | bigint | N | PK | | |
| member_id | 회원 ID | bigint | N | FK | shop.member.id | |
| coupon_id | 쿠폰 ID | bigint | Y | FK | shop.coupon.id | 쿠폰 없이 주문하면 비어 있음 (점선) |
| amount | 금액 | numeric(19,4) | N | | | |
| created_at | 생성 일시 | timestamptz | N | | | |
| updated_at | 수정 일시 | timestamptz | N | | | |

### shop.order_item 주문 상품
주문 한 줄. 기능: FN-ORD-001 · 공통 컬럼: 없음 (주문과 같이 쓰고 지운다) · 영역: 주문

| 컬럼 | 논리명 | 타입 | 널 | 키 | 참조 | 설명 |
|---|---|---|---|---|---|---|
| order_id | 주문 ID | bigint | N | PK,FK | shop.orders.id | |
| line_no | 줄 번호 | int | N | PK | | |
| product_code | 상품 코드 | varchar(20) | N | | | |
| quantity | 수량 | numeric(19,4) | N | | | |

### shop.coupon 쿠폰
쿠폰. 기능: 없음 (운영자가 SQL 로 넣는다, 결정 D-4) · 영역: 주문 · 회원

| 컬럼 | 논리명 | 타입 | 널 | 키 | 참조 | 설명 |
|---|---|---|---|---|---|---|
| id | ID | bigint | N | PK | | |
| code | 쿠폰 코드 | varchar(20) | N | UK | | |
| issued_to | 받은 회원 ID | bigint | Y | | 논리: shop.member.id | 회원을 지워도 쿠폰 이력은 남긴다 (논리 참조: DB 외래키 없이 앱이 지킨다) |
| created_at | 생성 일시 | timestamptz | N | | | |
| updated_at | 수정 일시 | timestamptz | N | | | |

<!--
칸 규칙
- 널: Y 면 널 허용 (빈칸 · N 은 NOT NULL). 널 허용 FK 는 ERD 에서 점선
- 키: PK · FK · UK 를 쉼표로 (복합 기본키는 여러 컬럼에 PK)
- 참조: FK 면 <스키마>.<테이블>.<컬럼>. DB 외래키 없이 앱이 지키는 참조는 키에 FK 없이 「논리: <스키마>.<테이블>[.<컬럼>]」 (논리 참조: ERD 에서 켜면 점선, 대상이 정의서에 없으면 ⚠)
- 설명 줄 꼬리표: 기능 · 결정 · 파티션 · 보존 · 공통 컬럼 · 영역 · 분류 · ERD · 고정 스키마.
- 고정 스키마: <근거> = 프레임워크가 만드는 테이블 (기본키 없음은 ⚠, 이름 · 공통 컬럼 · 타입 규칙은 건너뜀) 「기능: 없음」 · 「공통 컬럼: 없음」 은 검사에서 세지 않는다
- 영역: ERD 주제 영역 (여럿이면 · 로). 쓰면 모든 테이블에 단다 (일부만 있으면 검사가 알린다)
- 분류: 코드 = 값 목록 테이블, ERD: 선 숨김 = 감사 · 소유자처럼 많이 참조되는 테이블. ERD 의 「참조 많은 표 선 숨김」 을 켜면 그리로 가는 선을 숨긴다
- 컬럼 표 뒤의 다른 표(인덱스 등)는 ERD 에 넣지 않는다
-->
