# 데이터 설계

> 상태: 초안

테이블 정의서(스키마마다 `<스키마>.md`)와 이 목록이 짝이다. 정의서 양식은 `_template.md` 를 복사해 시작한다
(워크스페이스에서는 `datamodel` 스킬이 순서를 안내한다). ERD 는 `aidure docs build` 가 정의서에서 만든다.

- 기능 ID 마다 테이블을 대조한다. 저장하지 않는 기능은 테이블 칸에 「없음」 과 이유를 적는다.
- 테이블 · 컬럼은 기능 ID · 결정 ID 를 근거로 만든다.

## 엔티티 목록

| 엔티티 | 테이블 | 기능 ID | 비고 |
|---|---|---|---|
| <회원> | <shop.member> | <FN-MEM-001> | |

## 컨벤션

프로젝트가 정한 값이다 (워크스페이스 `workspace.json` 의 `vars.datamodel` 과 같게).

| 항목 | 값 |
|---|---|
| DB 종류 | <PostgreSQL> |
| 이름 | <snake_case · 단수 · 접두어 없음> |
| 기본키 | <bigint 대리키> |
| 공통 컬럼 | <created_at · updated_at> |
| 삭제 방식 | <물리 삭제> |
| 시점 · 금액 | <timestamptz · numeric> |
| 코드값 | <문자열 + CHECK> |
| 외래키 | <DB 에 건다> |

