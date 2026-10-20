---
name: handoff-organize
description: 이미 커진 본인 핸드오프 기록(수십만 자 주간 기록 · 흩어진 메모 파일 · 쌓인 색인)을 작업별 기록으로 나눠 정리한다. 원본은 지우지 않고 보관한다. "핸드오프 정리", "기록 정리", "핸드오프가 너무 길다" 요청에 쓴다.
---

# handoff-organize: 커진 기록 정리

주간 기록에 모든 내용이 쌓여 커진 워크스페이스를 **작업별 기록**(`handoffs/{id}/topics/`) 구조로 바꾼다. **본인 폴더만**, **지우지 않고** 한다.

## 1. 후보 보기

```bash
node packs/core/bin/handoff.js organize     # 큰 파일 · 흩어진 파일 · 자주 나온 티켓 (작업별 기록 후보)
node packs/core/bin/handoff.js check        # 크기 검사
```

사용자에게 후보를 보여 주고 **어느 작업부터 기록을 만들지** 고르게 한다 (기본: 자주 나온 티켓 상위 10개 + 진행 중인 작업). 한 번에 전부 하지 않아도 된다.

## 2. 작업마다 기록 만들기

작업 하나씩:

1. `node packs/core/bin/handoff.js find <작업> --id {id} --all` 로 그 작업이 나온 줄을 모은다.
2. 나온 줄 **근처만** 읽는다 (큰 파일을 통째로 읽지 않는다).
3. `topics/<작업>.md` 를 handoff 스킬의 형식(머리 5줄 · `## 요약` · 날짜 섹션)으로 쓴다. `## 요약` 에는 결정 · 원인 · 지켜야 할 함정 · 현재 상태를, 날짜 섹션에는 주요 날짜만 한두 줄씩과 원문 위치(`2026-W35.md:1904`)를 적는다.
4. 확인되지 않은 것은 "추정" 으로 적는다. 원문에 없는 내용을 지어내지 않는다.

흩어진 메모 파일(`IM-294-WIP.md` 같은)은 해당 작업 기록으로 옮기고(`git mv handoffs/{id}/<파일> handoffs/{id}/topics/<작업>.md` 또는 내용을 합친다), 쌓인 색인 파일(`INDEX-ARCHIVE.md` 같은)은 `archive/` 로 옮긴다.

## 3. 보관 · 색인 · 검사

```bash
node packs/core/bin/handoff.js archive --weeks 2   # 지난 주간 기록을 archive/ 로 (이번 주 · 지난주만 남긴다)
node packs/core/bin/handoff.js index               # INDEX.md
node packs/core/bin/handoff.js check
```

- LATEST.md 가 4KB 를 넘으면 작업별 기록 링크 위주로 줄인다.
- 옮긴 기록은 `find` 로 계속 찾을 수 있다고 사용자에게 알린다.

## 4. 커밋

핸드오프와 같다: `handoffs/{id}/` 만 스테이징 → `docs: 핸드오프 기록 정리 (작업별 기록 {n}개)` → pull --rebase → push. 사용자 승인 뒤에.

## 5. 보고

만든 작업별 기록 목록 · 옮긴 파일(보관) · 전후 크기(LATEST · 가장 큰 파일) · 아직 기록을 안 만든 후보.
