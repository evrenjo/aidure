---
title: Next.js 레이어 책임 · 데이터 접근 층
load: always
---

## Next.js 레이어 책임 · 데이터 접근 층 (App Router)

한 프로젝트 안에서 배치 전략 하나를 일관되게 쓴다 (기존 관례가 먼저). React 규칙도 함께 따른다.

- **`page` · `layout`:** 데이터 가져오기 호출과 조립만. 쿼리 · 권한 판단 · 가공은 데이터 접근 층으로.
- **`route.ts` · Server Action:** 입력 검증 · 인증 확인 · 위임 · 캐시 갱신(`revalidatePath` 등)만. DB 접근 · 업무 규칙은 데이터 접근 층에 둔다.
- **데이터 접근 층** (기존 위치, 없으면 `data/` 또는 `lib/`): 파일 맨 위에 `import 'server-only'`. 권한 확인 후 필요한 필드만 돌려준다. 비밀값(`process.env`)은 여기서만 읽는다.
- **위치:** 한 라우트 전용은 그 세그먼트의 `_components/` · `_lib/`, 여러 라우트 공용은 프로젝트가 정한 최상위(`components/` · `lib/`) 또는 기능 폴더. Server Action 은 기능별 `actions.ts`, 이름은 `<동사><대상>Action`.
- **클라이언트 컴포넌트(`'use client'`)** 에는 화면 상호작용만. 서버 전용 코드 · DB 클라이언트를 import 하지 않는다.
