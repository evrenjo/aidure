# 백엔드 보안 참고 — 값·표·절차

> 이 문서는 **참고용**이다. 규칙은 「백엔드 보안 — 인증·인가·비밀·외부 입력」 룰에 있고, 프로젝트에 이미 있는 보안 구성이 우선한다.
> 여기 값은 출처 문서(2026 기준)의 권장이며 버전이 오르면 바뀐다 — 쓰기 전에 `SOURCES.md` 의 원문을 확인한다.

## 1. 위험 목록과 이 팩 규칙의 대응

### OWASP Top 10:2025

| 항목 | 이 팩에서 막는 곳 |
|---|---|
| A01 Broken Access Control (SSRF 포함) | 보안 §1·§6, API 계약 §2 |
| A02 Security Misconfiguration | 보안 §3·§8, 외부 호출·설정 §6 |
| A03 Software Supply Chain Failures | 보안 §9 |
| A04 Cryptographic Failures | 보안 §2 (전용 해시, 직접 구현 금지) |
| A05 Injection | 데이터 접근 기본, 보안 §6 |
| A06 Insecure Design | API 계약 §2 (업무 흐름 한도), 계층 |
| A07 Authentication Failures | 보안 §2 |
| A08 Software or Data Integrity Failures | 보안 §6 역직렬화·§9 |
| A09 Security Logging and Alerting Failures | 로깅 「보안 이벤트」 |
| A10 Mishandling of Exceptional Conditions | API 계약 §4, 데이터 접근 「동시 수정·일관성」 fail closed |

### OWASP API Security Top 10 (2023)

| 항목 | 이 팩에서 막는 곳 |
|---|---|
| API1 Broken Object Level Authorization | 기본 원칙 「인가」, API 계약 §2 객체 단위 |
| API2 Broken Authentication | 보안 §2 |
| API3 Broken Object Property Level Authorization | API 계약 §2 속성 단위(대량 할당·과다 노출), 계층 「입출력 모델 분리」 |
| API4 Unrestricted Resource Consumption | 보안 §4, API 계약 §3·§6 |
| API5 Broken Function Level Authorization | API 계약 §2 기능 단위 |
| API6 Unrestricted Access to Sensitive Business Flows | API 계약 §2 업무 흐름 한도 |
| API7 Server Side Request Forgery | 보안 §6 |
| API8 Security Misconfiguration | 보안 §3·§8 |
| API9 Improper Inventory Management | API 계약 §9 (문서·폐기), 보안 §8 |
| API10 Unsafe Consumption of APIs | 보안 §6 외부 API 응답, 외부 호출 |

## 2. 비밀번호 저장 (OWASP Password Storage)

| 알고리즘 | 최소 설정 | 비고 |
|---|---|---|
| Argon2id | 메모리 19 MiB, 반복 2, 병렬 1 | 1순위 |
| scrypt | N=2^17, r=8, p=1 | |
| bcrypt | 작업 계수 10 이상 | 입력 72바이트 제한 — 레거시용 |
| PBKDF2-HMAC-SHA256 | 600,000 회 이상 | FIPS 요구 시 |

- 솔트는 알고리즘이 자동으로. 페퍼는 선택(교체 절차 필요).
- 작업 계수는 시간이 지나며 올리고, 로그인 때 새 계수로 다시 해시한다.
- 비밀번호 길이: 최소 8자(MFA 있음)·15자(없음), 최대 64자 이상 허용, 조용히 자르지 않는다. 유출된 비밀번호 목록과 대조.

## 3. 토큰(JWT) 검증 (OWASP REST Security)

- 무결성 보호(서명·MAC) 필수, `alg: none` 거부. 서명 방식이 가능하면 MAC 보다 서명.
- 검증 키·알고리즘은 **서버 설정**에서 — 토큰 헤더 값을 따르지 않는다.
- `iss`·`aud`·`exp`·`nbf` 확인. 폐기가 필요하면 `jti` 거부 목록.
- 토큰은 짧게, 리프레시는 서버에서 무효화 가능하게. 로그아웃 시 서버 세션 무효화(OWASP A01:2025).

## 4. API 응답 보안 헤더 (OWASP REST Security)

| 헤더 | 값 |
|---|---|
| `Cache-Control` | `no-store` (민감·사용자별 응답) |
| `Content-Security-Policy` | `frame-ancestors 'none'` (HTML 을 내는 API 면 `default-src 'none'`) |
| `Content-Type` | 본문과 맞는 형식 (`Accept` 를 그대로 복사하지 않는다) |
| `Strict-Transport-Security` | `max-age=…` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `no-referrer` (HTML) |

- 허용 안 된 메서드는 405, 잘못된 `Content-Type` 은 415, 줄 수 없는 `Accept` 는 406.
- 자격 증명은 URL 에 넣지 않는다. GET 의 민감 값은 헤더로.

## 5. CSRF·CORS

| 상황 | 방어 |
|---|---|
| 쿠키 인증 + 상태 변경 요청 | 동기화 토큰 또는 서명된 더블 서밋 쿠키, `SameSite=Lax/Strict`, `Sec-Fetch-Site`·Origin 확인 — 프레임워크 기본 기능 먼저 |
| 헤더 토큰(Bearer)만 쓰는 API | CSRF 토큰 불필요. 대신 쿠키로도 인증되는 경로가 없는지 확인 |
| 사용자 지정 헤더를 요구하는 API | 교차 출처 단순 요청이 막혀 방어가 된다(사전 요청 발생) |

- CORS: 교차 출처 호출을 안 쓰면 CORS 헤더를 켜지 않는다. 쓰면 허용 출처를 명시, `Origin` 반사 금지, 자격 증명 허용 시 `*` 불가, 동적 출처면 `Vary: Origin`.
- XSS 가 있으면 CSRF 방어가 무력해진다 — 출력 인코딩이 함께 가야 한다.

## 6. SSRF 차단 대상 (OWASP SSRF Prevention)

- 메타데이터: `169.254.169.254`, `metadata.google.internal` 등
- 루프백·미지정: `127.0.0.0/8`, `0.0.0.0/8`, `::1/128`
- 사설: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, 링크 로컬 `169.254.0.0/16`·`fe80::/10`, IPv6 고유 로컬 `fc00::/7`
- 멀티캐스트: `224.0.0.0/4`, `ff00::/8`
- 절차: 전체 URL 을 받지 않고 호스트만 → 허용 목록 대조 → 모든 A/AAAA 결과를 검사 → 리다이렉트 끔 → 해석한 IP 로 접속(재해석 사이 DNS 리바인딩 방지). 가능하면 네트워크 계층(방화벽·송신 프록시)에서도 막는다.

## 7. 파일 업로드 (OWASP File Upload)

1. 인증·인가
2. 크기 상한(업로드·다운로드 요청 수 포함)
3. 확장자 허용 목록 → `Content-Type` 허용 목록(위조 가능) → 파일 시그니처(단독 방어 아님)
4. 저장 이름 = 서버가 만든 무작위 ID. 원래 이름을 써야 하면 영숫자·하이픈·공백·마침표, 길이 제한
5. 웹 루트 밖 / 별도 호스트, 실행 권한 없음, 최소 권한
6. 악성코드 검사·샌드박스, 문서형(PDF·DOCX)은 무해화(CDR) 검토

## 8. 비밀 유출 대응 (OWASP Secrets Management)

1. 즉시 폐기(권한 회수)
2. 교체 — 새 비밀 배포
3. 코드 이력·로그·노출된 곳에서 삭제 (이력 재작성은 신중히, 사람이 결정)
4. 그 비밀이 언제·어디서·누구에게 쓰였는지 확인
5. 관련 팀에 알린다

- 예방: 커밋 전 비밀 탐지 훅 + CI 스캔. 환경 변수는 모든 프로세스가 읽을 수 있고 덤프·로그에 남을 수 있다 — 비밀 저장소·마운트 파일이 더 낫다(Twelve-Factor 의 "환경 변수에 설정" 과 긴장 관계, `SOURCES.md` 교차 검토 참고).

## 9. 로그에 남길 보안 이벤트 (OWASP Logging)

입력 검증 실패 · 인증 성공/실패 · 인가 실패 · 세션 관리 실패 · 관리 작업(사용자·권한 변경) · 민감 데이터 접근 · 데이터 가져오기/내보내기 · 파일 업로드 · 역직렬화 실패 · 외부 연결 실패 · 동의 기록 · 의심스러운 업무 로직

남기지 않는 것: 소스 코드, 세션 ID(필요하면 해시), 접근 토큰, 비밀번호·암호 키, 카드 데이터, DB 연결 문자열, 민감 개인정보. 이름·이메일·전화는 필요할 때만 마스킹.
