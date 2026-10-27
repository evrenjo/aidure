# 코어 룰 근거 자료

`packs/core/rules/` 의 규칙이 어디서 왔고 무엇이 뒷받침하는지 모은다. 상시 룰은 예산 때문에 출처를 적지 않고 이 문서로 모은다.
새 규칙을 넣거나 빼기 전에 이 문서의 [룰별 근거](#7-룰별-근거) 와 [교차 검증](#6-교차-검증--출처끼리-다른-점과-이-킷의-선택) 을 먼저 본다.

- 확인일: 2026-09-29. 링크가 바뀌거나 내용이 달라지면 이 문서를 고친다.
- 인용은 원문 그대로(영문) 싣는다. 번역·요약은 "요지" 칸에만 둔다.

## 목차

1. [조사 방법](#1-조사-방법)
2. [공식 문서 — 에이전트 도구 제공사](#2-공식-문서--에이전트-도구-제공사)
3. [공학 일반·보안 자료](#3-공학-일반보안-자료)
4. [연구 — 지침 파일이 실제로 효과가 있나](#4-연구--지침-파일이-실제로-효과가-있나)
5. [오픈소스 지침 파일 조사 (39개 repo)](#5-오픈소스-지침-파일-조사-39개-repo)
6. [교차 검증 — 출처끼리 다른 점과 이 킷의 선택](#6-교차-검증--출처끼리-다른-점과-이-킷의-선택)
7. [룰별 근거](#7-룰별-근거)
8. [채택하지 않은 것](#8-채택하지-않은-것)

## 1. 조사 방법

| 단계 | 내용 |
|---|---|
| 공식 문서 | Anthropic(Claude Code)·OpenAI(Codex)·GitHub(Copilot)·Cursor·Google(Gemini CLI) 문서를 원문으로 읽었다 |
| 공학 일반 | Google eng-practices, Conventional Commits, OWASP 치트시트·LLM Top 10, GitHub·OpenSSF 보안 문서 |
| 연구 | 지침 파일(AGENTS.md 등)의 효과를 측정한 2026년 논문 3편 + 상위 100개 repo 조사 글 1편 |
| 오픈소스 파일 | 널리 쓰이는 repo 41곳에서 루트 `AGENTS.md`·`CLAUDE.md`·.github/copilot-instructions.md 를 내려받았다(2026-09-29, 기본 브랜치). 지침 파일이 있는 **39개 repo 의 46개 파일**을 **전문으로** 읽었다 (내용 없이 다른 파일을 불러오기만 하는 한 줄짜리는 제외) |
| 분류 | 파일마다 프로젝트 고유 명령·구조 설명을 빼고 **일반 행동 규칙**만 28개 분류(C01~C28)로 나눴다. 분류마다 원문 인용과 줄 번호를 남겼고, 이 문서에 실은 repo 인용은 내려받은 원문과 글자 단위로 대조했다 |
| 웹 문서 인용 | 2·3·4장의 따옴표 인용도 페이지 원문(HTML)을 내려받아 글자 단위로 대조했다. 굵게·코드 표시는 뺐다 |

분류 코드는 [5.2](#52-분류별-빈도) 표에 있다.

## 2. 공식 문서 — 에이전트 도구 제공사

| 출처 | 요지 | 쓰인 곳 |
|---|---|---|
| [Claude Code — How Claude remembers your project](https://code.claude.com/docs/en/memory) | 지침은 "context, not enforced configuration". 짧고 구체적으로("Use 2-space indentation" 처럼 검증 가능하게), 파일당 200줄 이하, 서로 부딪히지 않게. 반드시 실행돼야 하는 것은 훅으로. 추가 시점 = "Claude makes the same mistake a second time" | 40·41 |
| [Claude Code — Best practices](https://code.claude.com/docs/en/best-practices) | "Give Claude a way to verify its work". "Have Claude show evidence rather than asserting success". 탐색·계획을 구현과 분리하되 "If you could describe the diff in one sentence, skip the plan". "address the root cause, don't suppress the error". 지침 줄마다 "Would removing this cause Claude to make mistakes?" | 20·21·25·28·41 |
| [Claude Code — Common workflows](https://code.claude.com/docs/en/common-workflows) | 버그는 재현 명령·스택 트레이스부터, 리팩터링은 "small, testable increments" 로 동작을 유지하며, 테스트는 기존 패턴을 따르고 경계 조건을 찾는다 | 21·28 |
| [Claude Code — Security](https://code.claude.com/docs/en/security) | 프롬프트 인젝션 대응: 신뢰할 수 없는 내용을 그대로 흘려 넣지 않기, 명령·중요 파일 변경은 검토 후 승인, 네트워크 명령은 기본 승인 대상 아님 | 26·27 |
| [OpenAI Codex — AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md) | 루트→현재 폴더 순으로 합치고 가까운 파일이 뒤에 온다. 합친 크기가 `project_doc_max_bytes`(기본 32 KiB)에 닿으면 더 넣지 않는다. 예시 규칙에 "Ask for confirmation before adding new production dependencies" | 41 예산, 25 의존성 |
| [OpenAI Codex — Best practices](https://learn.chatgpt.com/guides/best-practices) | 요청은 Goal·Context·Constraints·"Done when". "A short, accurate AGENTS.md is more useful than a long file full of vague rules". "run the relevant checks, confirm the result, and review the work before you accept it". 권한은 좁게 시작 | 21·28·41 |
| [OpenAI — Codex prompting guide](https://developers.openai.com/cookbook/examples/gpt-5/codex_prompting_guide) | "NEVER revert existing changes you did not make", "NEVER use destructive commands like `git reset --hard` or `git checkout --` unless specifically requested or approved", "Do not amend a commit unless explicitly requested". 반면 "Bias to action … do not end your turn with clarifications unless truly blocked" ([6장](#6-교차-검증--출처끼리-다른-점과-이-킷의-선택) 참고) | 50·28 |
| [agents.md](https://agents.md/) | 도구 중립 형식. 빌드·테스트 명령, 코드 스타일, 테스트, 보안, PR 규칙을 담는다. "the closest one takes precedence", 사용자 지시가 모든 파일보다 우선 | 팩 구조 전반 |
| [GitHub Copilot — repository custom instructions](https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions) | 지침 생성용 예시 프롬프트의 제한: "Instructions must be no longer than 2 pages.", "Instructions must not be task specific." 지침끼리 충돌 금지, 겪은 오류와 해결법을 적어 두기 | 41 |
| [GitHub Copilot — best practices for tasks](https://docs.github.com/copilot/how-tos/agents/copilot-coding-agent/best-practices-for-using-copilot-to-work-on-tasks) | 좋은 작업 = 문제 설명 + 완료 기준 + 바꿀 파일. 모호한 작업·보안/인증/개인정보 작업은 에이전트에 맡기지 말 것 | 28 모호함, 27 |
| [Cursor — Rules](https://cursor.com/docs/context/rules) | 규칙은 "focused, actionable, and scoped", 500줄 이하로 쪼갠다. 린터가 하는 스타일 가이드·흔한 명령은 복제하지 않는다. 같은 실수가 반복될 때만 추가 | 41 |
| [Gemini CLI — GEMINI.md](https://google-gemini.github.io/gemini-cli/docs/cli/gemini-md.html) | 전역·프로젝트·하위 폴더 3단 문맥 파일, import 로 나눈다 | 팩 구조 전반 |
| [Anthropic — Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) | 지침은 "the minimal set of information that fully outlines your expected behavior". 문맥이 길수록 회상이 떨어진다(context rot). 필요할 때 불러오는 "just in time" 방식 | 40·41 (상시/on-demand 구분) |

## 3. 공학 일반·보안 자료

| 출처 | 요지 | 쓰인 곳 |
|---|---|---|
| [Google eng-practices — Small CLs](https://google.github.io/eng-practices/review/developer/small-cls.html) | "one self-contained change", 관련 테스트 포함. 작으면 리뷰가 빠르고 정확하며 되돌리기 쉽다 | 25·28 범위 |
| [Google eng-practices — What to look for](https://google.github.io/eng-practices/review/reviewer/looking-for.html) | "solve the problem they know needs to be solved now", 주석은 "why" 를, 기존 코드와 일관, 동작이 바뀌면 문서도 | 25·28 |
| [Google eng-practices — CL descriptions](https://google.github.io/eng-practices/review/developer/cl-descriptions.html) | 첫 줄은 짧은 명령형 요약, 본문은 무엇을·왜. 제출 전 설명이 최종 변경과 맞는지 다시 본다 | 11, 워크플로 팩 커밋 규칙 |
| [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) | `type(scope): description`. 코어는 "repo 관례를 따른다" 만 두고 형식은 워크플로 팩이 정한다 | 50 |
| [OWASP — Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html) | 소스에 비밀값 금지, pre-commit·CI 로 탐지, 유출 시 폐기·교체 | 26·27 |
| [OWASP — Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | 로그에서 빼거나 가릴 것: 세션 식별자, 액세스 토큰, 비밀번호, DB 접속 문자열, 암호화 키, 결제 정보, 민감한 개인정보 | 27 §1 |
| [GitHub — Removing sensitive data from a repository](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository) | "as a first step you need to revoke and/or rotate that secret". 히스토리 재작성은 그다음 선택 | 26·27 §1 |
| [OWASP GenAI — LLM01 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) | 외부 내용 속 지시가 모델 행동을 바꾸는 간접 인젝션. 완화: 최소 권한, 고위험 행동은 사람 승인, "Separate and clearly denote untrusted content" | 26·27 §6 |
| [OWASP GenAI — LLM06 Excessive Agency](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/) | 과한 기능·권한·자율이 원인. 범위 최소화, 최소 권한, "human-in-the-loop" 승인 | 10 승인, 26 |
| [OpenSSF — Concise Guide for Evaluating Open Source Software](https://best.openssf.org/Concise-Guide-for-Evaluating-Open-Source-Software) | "Every new dependency increases the attack surface". 유지 상태·진위(유사 이름)·라이선스 확인 | 25·27 §5 |

## 4. 연구 — 지침 파일이 실제로 효과가 있나

| 출처 | 요지 | 이 킷에 주는 뜻 |
|---|---|---|
| Gloaguen 외, [Evaluating AGENTS.md: Are Repository-Level Context Files Helpful for Coding Agents?](https://arxiv.org/abs/2602.11988) (2026) | 지침 파일이 과제 성공률을 대체로 올리지 않고 추론 비용을 평균 20% 넘게 늘린다. 지침 **자체는 잘 지켜진다**. 저장소 개요는 도움이 안 되고, "context files are useful for specifying non-standard coding practices" | 상시 룰에는 **코드로 알 수 없는 비표준 판단·금지만**. 폴더 설명·개요는 넣지 않는다 (41) |
| Khatri, [Do Context Files Help Coding Agents? A Two-Agent Ablation Study](https://arxiv.org/abs/2607.27250) (2026) | Claude Code·Codex 288회 실행에서 지침 주입 방식이 정답률을 측정 가능하게 바꾸지 않았다. 실패 원인은 저장소 지식 부족이 아니라 구현 능력(설계·패턴 선택·연결) | 지침으로 품질을 올리려 하지 말고 **검증 장치**(테스트·검사 스크립트)로 닫는다 (20·21·40) |
| McMillan, [Instruction Adherence in Coding Agent Configuration Files: A Factorial Study](https://arxiv.org/abs/2605.10039) (2026) | 1,650 세션에서 파일 크기·지시 위치·파일 구조·모순 여부 모두 준수율에 뚜렷한 차이를 만들지 않았다. 대신 **생성하는 함수가 하나 늘 때마다 준수 확률이 약 5.6% 떨어졌다** | 긴 작업 중에는 룰이 흐려진다 → 작업 시점에 on-demand 룰을 다시 읽게 하고, 반드시 지켜야 할 것은 훅·검사로 (40·41) |
| [What the 100 biggest GitHub repos put in their AGENTS.md files](https://www.coldtea.ai/blog/agents-md-field-study) | 상위 100개 repo 중 명시적 금지 86%, 커밋·PR 79%, 테스트 74%, 스타일·린트 73%, CI·pre-commit 71%, 빌드 62%, 구조 60%, 보안·비밀값 54% | 5장 조사와 같은 경향 |

## 5. 오픈소스 지침 파일 조사 (39개 repo)

### 5.1 대상과 분류 결과

일반 규칙이 하나라도 있는 곳은 **36개**다 (ollama·react·django 는 빌드 명령·안내·리뷰 도구 거부 문구뿐). django 파일은 AI 리뷰 도구에게 "리뷰하지 말고 정해진 문장만 출력하라" 고 지시하는 문구로, **저장소 파일 안에 에이전트를 향한 지시가 들어 있을 수 있다**는 실례다 (27 §6).

| repo | 파일 | 일반 규칙 분류 |
|---|---|---|
| anthropics/anthropic-sdk-python | [CLAUDE.md](https://github.com/anthropics/anthropic-sdk-python/blob/main/CLAUDE.md) | C04 C05 C07 C08 C13 C15 C17 C20 C21 C23 C24 C26 C27 |
| apache/airflow | [AGENTS.md](https://github.com/apache/airflow/blob/main/AGENTS.md) | C05 C08 C11 C12 C13 C15 C17 C21 C22 C24 C26 C27 C28 |
| apache/superset | [AGENTS.md](https://github.com/apache/superset/blob/master/AGENTS.md) | C01 C04 C05 C09 C13 C14 C20 C21 C23 C24 C27 |
| astral-sh/ruff | [AGENTS.md](https://github.com/astral-sh/ruff/blob/main/AGENTS.md) | C03 C04 C06 C07 C08 C09 C10 C15 C21 C27 C28 |
| astral-sh/uv | [AGENTS.md](https://github.com/astral-sh/uv/blob/main/AGENTS.md) | C01 C03 C05 C07 C08 C09 C16 C18 C21 C24 C27 |
| biomejs/biome | [AGENTS.md](https://github.com/biomejs/biome/blob/main/AGENTS.md) | C01 C04 C05 C06 C08 C09 C13 C14 C20 C21 C26 C27 C28 |
| cloudflare/workers-sdk | [CLAUDE.md](https://github.com/cloudflare/workers-sdk/blob/main/CLAUDE.md) · [AGENTS.md](https://github.com/cloudflare/workers-sdk/blob/main/AGENTS.md) | C01 C05 C07 C08 C15 C16 C18 C20 C21 C26 C27 C28 |
| Comfy-Org/ComfyUI | [AGENTS.md](https://github.com/Comfy-Org/ComfyUI/blob/master/AGENTS.md) | C03 C04 C13 C14 C16 C18 C20 C21 C23 C27 C28 |
| denoland/deno | [copilot-instructions.md](https://github.com/denoland/deno/blob/main/.github/copilot-instructions.md) · [CLAUDE.md](https://github.com/denoland/deno/blob/main/CLAUDE.md) | C03 C04 C05 C09 C13 C14 C24 C26 C27 C28 |
| django/django | [copilot-instructions.md](https://github.com/django/django/blob/main/.github/copilot-instructions.md) | — (AI 리뷰 도구에게 리뷰를 거부하라는 문구만 — 일반 규칙 없음) |
| dotnet/runtime | [copilot-instructions.md](https://github.com/dotnet/runtime/blob/main/.github/copilot-instructions.md) | C01 C03 C04 C05 C06 C07 C09 C10 C11 C12 C13 C14 C21 C23 C25 C26 C27 C28 |
| elastic/kibana | [AGENTS.md](https://github.com/elastic/kibana/blob/main/AGENTS.md) | C03 C04 C07 C10 C18 C20 C21 C27 C28 |
| facebook/react | [CLAUDE.md](https://github.com/facebook/react/blob/main/CLAUDE.md) | — (모노레포 안내만) |
| getsentry/sentry | [AGENTS.md](https://github.com/getsentry/sentry/blob/master/AGENTS.md) | C01 C05 C14 C17 C20 C24 C28 |
| gohugoio/hugo | [AGENTS.md](https://github.com/gohugoio/hugo/blob/master/AGENTS.md) | C03 C05 C08 C13 C21 C22 C27 C28 |
| grafana/grafana | [AGENTS.md](https://github.com/grafana/grafana/blob/main/AGENTS.md) | C03 C04 C08 C12 C14 C18 C21 |
| huggingface/transformers | [copilot-instructions.md](https://github.com/huggingface/transformers/blob/main/.github/copilot-instructions.md) | C03 C04 C05 C08 C15 |
| kubernetes/kubernetes | [AGENTS.md](https://github.com/kubernetes/kubernetes/blob/master/AGENTS.md) | C03 C04 C08 C13 C15 C16 C21 C27 C28 |
| langchain-ai/langchain | [AGENTS.md](https://github.com/langchain-ai/langchain/blob/master/AGENTS.md) | C01 C02 C03 C04 C06 C08 C09 C13 C14 C15 C16 C18 C21 C23 C24 C26 C27 |
| microsoft/playwright | [CLAUDE.md](https://github.com/microsoft/playwright/blob/main/CLAUDE.md) · [copilot-instructions.md](https://github.com/microsoft/playwright/blob/main/.github/copilot-instructions.md) | C03 C04 C05 C06 C12 C13 C14 C20 C26 C28 |
| microsoft/TypeScript | [copilot-instructions.md](https://github.com/microsoft/TypeScript/blob/main/.github/copilot-instructions.md) | C05 C06 C07 C08 C14 C16 C24 |
| microsoft/vscode | [AGENTS.md](https://github.com/microsoft/vscode/blob/main/AGENTS.md) · [copilot-instructions.md](https://github.com/microsoft/vscode/blob/main/.github/copilot-instructions.md) | C01 C03 C05 C08 C22 C25 C27 C28 |
| modelcontextprotocol/servers | [CLAUDE.md](https://github.com/modelcontextprotocol/servers/blob/main/CLAUDE.md) | C08 C14 C18 |
| n8n-io/n8n | [AGENTS.md](https://github.com/n8n-io/n8n/blob/master/AGENTS.md) | C03 C05 C07 C12 C13 C14 C17 C21 C22 C23 C24 C25 C26 C27 C28 |
| neovim/neovim | [AGENTS.md](https://github.com/neovim/neovim/blob/master/AGENTS.md) | C13 |
| ollama/ollama | [AGENTS.md](https://github.com/ollama/ollama/blob/main/AGENTS.md) | — (빌드 명령·안내만) |
| openai/codex | [AGENTS.md](https://github.com/openai/codex/blob/main/AGENTS.md) | C02 C03 C04 C08 C15 C16 C23 C24 C25 C27 |
| openai/openai-agents-python | [AGENTS.md](https://github.com/openai/openai-agents-python/blob/main/AGENTS.md) | C02 C04 C06 C07 C08 C10 C11 C12 C13 C14 C17 C18 C19 C23 C26 |
| OpenHands/OpenHands | [AGENTS.md](https://github.com/OpenHands/OpenHands/blob/main/AGENTS.md) | C01 C03 C08 C10 C14 C26 C27 C28 |
| oven-sh/bun | [CLAUDE.md](https://github.com/oven-sh/bun/blob/main/CLAUDE.md) | C03 C05 C06 C07 C08 C09 C12 C21 C22 C24 |
| PostHog/posthog | [AGENTS.md](https://github.com/PostHog/posthog/blob/master/AGENTS.md) | C01 C04 C05 C06 C07 C08 C11 C12 C13 C14 C15 C17 C19 C20 C21 C24 C26 C27 |
| prisma/prisma | [AGENTS.md](https://github.com/prisma/prisma/blob/main/AGENTS.md) | C07 C08 C10 C11 C20 C21 C23 C24 C27 |
| pytorch/pytorch | [CLAUDE.md](https://github.com/pytorch/pytorch/blob/main/CLAUDE.md) · [copilot-instructions.md](https://github.com/pytorch/pytorch/blob/main/.github/copilot-instructions.md) | C03 C04 C05 C07 C10 C12 C13 C14 C15 C16 C21 C22 C24 C26 C27 |
| supabase/supabase | [AGENTS.md](https://github.com/supabase/supabase/blob/master/AGENTS.md) · [copilot-instructions.md](https://github.com/supabase/supabase/blob/master/.github/copilot-instructions.md) | C01 C15 C28 |
| sveltejs/svelte | [AGENTS.md](https://github.com/sveltejs/svelte/blob/main/AGENTS.md) | C01 C05 C14 |
| temporalio/temporal | [copilot-instructions.md](https://github.com/temporalio/temporal/blob/main/.github/copilot-instructions.md) · [AGENTS.md](https://github.com/temporalio/temporal/blob/main/AGENTS.md) | C02 C03 C04 C05 C06 C09 C10 C11 C15 C16 C21 C27 C28 |
| vercel/next.js | [AGENTS.md](https://github.com/vercel/next.js/blob/canary/AGENTS.md) | C01 C02 C03 C05 C10 C11 C12 C13 C17 C19 C22 C25 C26 C28 |
| vitejs/vite | [copilot-instructions.md](https://github.com/vitejs/vite/blob/main/.github/copilot-instructions.md) | C03 C04 C05 C08 C13 C20 C21 C27 |
| withastro/astro | [AGENTS.md](https://github.com/withastro/astro/blob/main/AGENTS.md) | C02 C03 C04 C08 C10 C20 C21 C27 C28 |

### 5.2 분류별 빈도

분모 = 일반 규칙이 있는 36개 repo. "대표 인용" 은 원문 그대로다.

| 코드 | 분류 | repo 수 | 대표 인용 |
|---|---|---:|---|
| C27 | 언어와 무관한 코드 품질 (단순함·타입·오류 처리) | 24 | astro: "If you write 200 lines and it could be 50, rewrite it." · kubernetes: "Error messages: actionable and specific." |
| C03 | 기존 관례·패턴 따르기, 있는 유틸 재사용 | 22 | astro: "Match existing style, even if you'd do it differently." · temporal: "Existing utilities are reused before new ones are created." |
| C05 | 끝내기 전 테스트·린트·타입체크·빌드 | 22 | temporal: "After making code changes, execute the project-specific build, linting and type-checking commands" · bun: "If you didn't run the tests, your code does not work." |
| C08 | 변경과 함께 테스트, 버그는 재현 테스트 | 22 | anthropic-sdk-python: "A behaviour change comes with a test that fails before it and passes after." · posthog: "Every new test must catch a realistic regression no existing test catches." |
| C21 | 주석은 "왜" 만, 최소한으로 | 22 | astro: "Never narrate change history (\"now\", \"previously\", \"no longer\") and never address the reviewer" · posthog: "Explain _why_, not _what_" |
| C04 | 범위 최소, 관계없는 변경 금지 | 20 | astro: "Every changed line should trace directly to the user's request." · kibana: "Make focused changes; avoid unrelated refactors." |
| C28 | 기타 (공개 글 위생·간결한 말투 등) | 19 | sentry: "Never include customer information in pull requests, commits, or code" · hugo: "Brevity is good." |
| C13 | 커밋 메시지·AI 표기 | 18 | playwright: "A `Co-Authored-By:` trailer naming an agent, model, or tool" (금지) · kubernetes: "disclose whether AI was used" (요구) |
| C14 | PR 관례 (템플릿·초안·설명) | 17 | svelte: "you **MUST** read `PULL_REQUEST_TEMPLATE.md` and fill it out correctly" · dotnet: "One concern per PR." |
| C24 | 프로젝트 래퍼 명령 사용 | 14 | codex: "Do not run cargo test directly. Use just test so test execution follows the repo defaults." |
| C26 | git 안전 (브랜치·강제 push·amend·남의 변경) | 14 | biome: "Preserve unrelated worktree changes. Never revert or rewrite changes you did not make." · playwright: "Never amend commits." |
| C01 | 고치기 전에 읽기 (코드·README·하위 지침) | 13 | biome: "Read files in full before wide-ranging changes, before editing an unfamiliar file" · workers-sdk: "Locate and read the closest applicable file before making changes." |
| C07 | 검사를 끄거나 테스트를 빼서 통과시키지 않기 | 13 | kibana: "Never remove, skip, or comment out tests to make them pass; fix the underlying code." · posthog: "Never bypass the pre-push hooks (`--no-verify`)." |
| C15 | 생성물 손으로 고치지 않기 | 12 | workers-sdk: "Do not edit generated files directly. Change their source or generator and regenerate them." |
| C20 | 동작이 바뀌면 문서도 | 12 | workers-sdk: "When a change makes guidance inaccurate, update that file in the same change." |
| C06 | 증거·정직한 보고 | 10 | dotnet: "Don't claim more than you verified. Say what you built and ran, and what you didn't." · bun: "NEVER overstate what you got done" |
| C10 | 모호하면 묻기 | 10 | astro: "If multiple interpretations exist, present them - don't pick silently." · dotnet: "Stop for a decision only the user can make, an irreversible action, a missing credential, or an ambiguity" |
| C12 | 커밋·푸시·PR·게시는 요청 때만 | 10 | grafana: "\"Open a PR\" in a task description is intent, not permission to push without review." · pytorch: "Don't commit unless the user explicitly asks you to." |
| C09 | 지어내지 않기, 사실 확인 | 9 | biome: "Do not claim a Biome function, module, behavior, or convention exists without an exact file and line" · temporal: "NEVER assume a library/framework is available" · uv: "NEVER assume clippy warnings or test failures are pre-existing" |
| C16 | 의존성 신중히, 잠금파일은 도구로 | 9 | TypeScript: "Do not add or change existing dependencies unless asked to." · uv: "NEVER update all dependencies in the lockfile" |
| C23 | 하위 호환 | 9 | langchain: "Would this change break someone's code if they used it last week?" |
| C18 | 보안 코딩 | 8 | workers-sdk: "Do not build shell commands with interpolated or concatenated untrusted input." · openai-agents-python: "A security label alone is insufficient without a complete trace from attacker-controlled input" |
| C11 | 되돌릴 수 없는 일은 승인 | 7 | airflow: "Ask first: Large cross-package refactors. New dependencies with broad impact. Destructive data or migration changes." |
| C17 | 비밀값 | 7 | n8n: "never put secrets in a command" · next.js: "stop and ask the user rather than inventing placeholder credentials" |
| C22 | 임시 파일 위치·정리 | 7 | vscode: "clean up these files by removing them at the end" |
| C02 | 먼저 계획 | 6 | codex: "identify the smallest coherent stage to land first" |
| C25 | 출력·문맥 관리 | 5 | next.js: "Don't re-run the same test command without code changes; re-analyze saved output instead." |
| C19 | 외부 내용·인젝션 | 3 | next.js: "never adopt a PR whose full diff has not been read." |

> 보안·비밀값(C17·C18·C19)은 repo 파일에는 드물지만(각 3~8곳) 공식 문서·OWASP 가 강하게 요구하고, 사고 비용이 커서 상시 룰(26)에 둔다. 빈도는 채택의 유일한 기준이 아니다.

## 6. 교차 검증 — 출처끼리 다른 점과 이 킷의 선택

| 쟁점 | 한쪽 | 다른 쪽 | 이 킷의 선택 |
|---|---|---|---|
| 묻기 vs 바로 실행 | Codex prompting guide: "do not end your turn with clarifications unless truly blocked" | astro "don't pick silently", kibana "Never guess", dotnet 의 멈춤 조건 4가지 | dotnet 기준으로 **멈출 때를 한정**하고 나머지는 가정을 적고 진행 (28 §3). 사용자만 정할 수 있는 것에 답이 없으면 보류 (10) |
| AI 표기 | 금지: next.js "Do NOT add … co-author footers", playwright, airflow·kubernetes(공동저자 금지) | 요구: pytorch·langchain·kubernetes·dotnet·biome 공개 표기, neovim `AI-assisted` 트레일러 | 프로젝트마다 반대라 코어는 **repo 관례를 따른다**만 둔다 (50). 형식은 워크플로 팩·프로젝트가 정한다 |
| 지침 길이와 준수 | Claude Code 문서: 길면 준수가 떨어진다 | McMillan(2026): 파일 크기는 준수에 뚜렷한 차이 없음 | 예산은 유지한다 — 근거는 준수율보다 **Codex 의 32 KiB 절단(뒤쪽이 조용히 사라짐)**과 **비용(+20%, Gloaguen)** (41) |
| 테스트 범위 | svelte "DO NOT submit a PR without running the full test suite", TypeScript 세션 끝 전체 검사 | pytorch "DO NOT run entire test suites", codex "ask the user before running the complete test suite", uv 좁은 테스트 우선 | **좁게 → 넓게**, 공통 모듈·계약을 바꿨으면 넓힌다. 못 돌린 것은 "미실행" (21 §1·§2) |
| 주석 양 | prisma "Don't add comments if avoidable", anthropic-sdk "Write no comment by default" | workers-sdk 공개 함수 JSDoc, superset 새 함수 docstring 필수 | 공통분모 = **"왜" 만, 변경 이력 금지**. 양은 repo 관례 (28 §10) |
| 테스트 먼저 vs 테스트 절제 | prisma "Always write tests before …", OpenHands TDD | posthog·codex·airflow: 기존 테스트가 잡는 것·정적 값·삭제된 로직에 테스트 추가 금지 | 둘은 양립 — **버그는 실패하는 재현부터**, 새 테스트는 **잡을 회귀를 댈 수 있을 때만** (21 §4) |
| 작업 공간 | next.js "Prefer a throwaway git worktree" | openai-agents-python "Do not create or switch to another Git worktree … unless the user explicitly asks" | 코어는 정하지 않는다 — 브랜치·worktree 는 워크플로 팩과 사용자 지시. 코어는 "남의 변경을 되돌리지 않는다" 만 (50) |
| 지침 파일의 효용 | 제공사 문서: 개요·명령·관례를 넣으라 | Gloaguen·Khatri: 개요는 효과 없음, 정답률 변화 없음 | 상시 룰은 **비표준 판단·금지**만, 나머지는 장치와 on-demand (40·41) |

## 7. 룰별 근거

"팀" = 이 킷이 떼어 낸 실제 프로젝트에서 겪은 사고로 생긴 규칙. 외부 출처는 그것을 뒷받침·보완한다.

### `packs/core/rules/10-communication.md` (상시)

| 항목 | 근거 |
|---|---|
| 결론 먼저·간결 | 팀 · hugo "Brevity is good." · kubernetes "Skip preambles and postambles." · biome "Keep responses short, factual, and technical." |
| 약어 풀어 쓰기·호칭·언어·행동 요청 형식 | 팀 |
| 결정은 선택지 질문, 권장안 첫째 | 팀 · kibana "if still stuck, ask w/ short options" · astro "present them - don't pick silently" |
| 답을 받기 전엔 진행하지 않음 | 팀 · dotnet "Stop for a decision only the user can make" · OWASP LLM06 human-in-the-loop |
| 승인은 건마다 (커밋·푸시·PR·이슈/코멘트 게시·DB·핸드오프) | 팀 · C12 10곳 (pytorch "You may never act autonomously on GitHub", grafana "intent, not permission", posthog "without explicit user approval in the current conversation") · OWASP LLM06 |
| 푸시 안 한 커밋은 완료 아님 | 팀 |
| 규칙 위치 밝히기 | 팀 · sentry "AGENTS.md files are the source of truth … do not duplicate long guidance in editor-specific rule files" |

### `packs/core/rules/11-confirm-request-tone.md` (on-demand)

| 항목 | 근거 |
|---|---|
| 3단 구성·추정형 표현·확인 항목 4칸 | 팀 · Google CL descriptions(무엇을·왜, 맥락) · supabase "Be advisory, not prescriptive." · temporal "explain why something should change rather than only stating that it should" |

### `packs/core/rules/20-evidence.md` (상시)

| 항목 | 근거 |
|---|---|
| 확인됨/추정/미확인 | 팀 · biome "If evidence is unavailable, state that rather than presenting the claim as fact." |
| 지어내지 않기 | C09 9곳 · temporal "NEVER assume a library/framework is available", "NEVER assume standard test commands." · langchain "Do not rely on memorized or cached model names" |
| 한 갈래로 일반화 금지 | 팀 · dotnet "A review comment or an issue flags examples of a problem, not every instance." |
| 문서와 다름은 판정 후 한 곳만 | 팀 · langchain "Treat source code and tests as authoritative." · superset "instead of using cached content" · 실제 프로젝트 기획 repo 분석(같은 사실이 7~9개 문서에 다시 쓰여 어긋남) · Ambler "fewest documents with least overlap" |
| 닫는 주장은 더 강한 근거 | 팀 · deno "If you claim something is missing … search the full diff AND the existing codebase" · uv "NEVER assume … failures are pre-existing" |
| 완료는 실행한 검증으로, 검사 끄기 금지 | C05 22곳 · C07 13곳 · Claude Code best practices "show evidence rather than asserting success", "don't suppress the error" · Codex best practices "run the relevant checks, confirm the result" |
| 검증표 | 팀 · dotnet "Say what you built and ran, and what you didn't." |
| 계약 변경 시 30번 | 팀 · codex "Search for breaking changes in external integration surfaces" |

### `packs/core/rules/21-verification.md` (on-demand)

| 항목 | 근거 |
|---|---|
| 프로젝트 명령 먼저, 래퍼 사용 | C24 14곳 · temporal "NEVER assume standard test commands." · codex `just test` |
| 좁게 → 넓게 | biome "Run the narrowest relevant tests first, then broader checks when justified." · workers-sdk 같은 취지 · 6장 "테스트 범위" |
| 실패하는 재현 먼저 | astro "Write a test that reproduces it, then make it pass" · anthropic-sdk "fails before it and passes after" · TypeScript "a minimal test case should always be added in advance" · Claude Code common workflows |
| 화면은 띄워서 확인 | posthog "Visual and UX work is not confirmed by reading the code." · Claude Code best practices(스크린샷 비교) · 팀(로딩 중 캡처 오판) |
| 원인 수정, 억제 금지 | C07 13곳 · anthropic-sdk "Suppress only when the checker is the one that is wrong." · cloudflare "Lint-disable comments require a reason" |
| 기존 실패 단정 금지 | uv "NEVER assume clippy warnings or test failures are pre-existing" |
| 출력 파일로, 재실행 대신 재분석 | C25 5곳 · next.js "re-analyze saved output instead" · n8n "ALWAYS redirect the output of the build command to a file" · dotnet "Redirect long-running commands to a log" |
| 가짜 자격 증명 금지 | next.js "rather than inventing placeholder credentials" · workers-sdk "Do not run credentialed E2E tests unless …" |
| 축이 다른 5케이스 | 팀 · OpenHands "Test every path with distinct control or data flow without testing an irrelevant Cartesian product." |
| 테스트 품질 (회귀를 잡을 때만, 실패 가능성, 공개 인터페이스, 기존 파일, sleep 금지, 스냅샷 검토) | posthog · codex "Do not add tests for values that are statically defined." · anthropic-sdk "Go through the public API" · uv·ruff 기존 파일 우선 · bun "Do not use `setTimeout` or `await sleep(N)`" · ruff·biome 스냅샷 |
| 미실행은 구체적 이유 | posthog "Report \"can't run\" only for a specific, nameable failure" |
| 한 것보다 크게 말하지 않기 | dotnet "A patch you composed is not a patch you applied", "don't describe a plan as though it were done" · bun "NEVER overstate" |
| 외부인 눈으로 다시 읽기 | ruff "reread each changed artifact as someone with no access to the Codex session" · Claude Code best practices(새 문맥의 리뷰) |
| 내가 만든 미사용만 지우기 | astro "Remove imports/variables/functions that YOUR changes made unused." |

### `packs/core/rules/25-work-principles.md` (상시) · `packs/core/rules/28-work-detail.md` (on-demand)

| 항목 | 근거 |
|---|---|
| 고치기 전에 이해 | C01 13곳 · next.js README 경로 읽기 · biome 전체 읽기 · Claude Code best practices "Explore first, then plan, then code" |
| 계획은 필요할 때만 | C02 6곳 · Claude Code "If you could describe the diff in one sentence, skip the plan" · Codex prompting guide "Skip using the planning tool for straightforward tasks" · codex 단계 나누기 |
| 기존 관례·유틸 | C03 22곳 · Claude Code "Reference existing patterns" · Google "consistency" |
| 범위 | C04 20곳 · Google Small CLs · astro "trace directly to the user's request", "Don't refactor things that aren't broken." · ruff "do not confuse keeping the task focused with minimizing the size of the implementation" |
| 모호하면 묻기(멈출 조건 한정) | C10 10곳 · dotnet 멈춤 조건 · 6장 "묻기 vs 바로 실행" · GitHub Copilot "ambiguous requirements" 경고 |
| 전제가 틀리면 먼저 말하기 | dotnet "Say so before building on a premise that doesn't hold" · astro "If a simpler approach exists, say so." |
| 생성물·잠금파일 | C15 12곳 · C16 9곳 · kubernetes "Generated files are read-only." · anthropic-sdk "Check whether a line is generated before you change it." |
| 의존성은 근거와 함께 | C16 · Codex AGENTS.md 예시 · OpenSSF · ComfyUI "Do not add new dependencies … unless they are absolutely necessary." |
| 문서·주석 동시 갱신 | C20 12곳 · Google "What to look for" · workers-sdk "update that file in the same change" · astro "never replace specific docs with generic text" |
| 주석 정책 | C21 22곳 · astro "Deletion test" · superset "Avoid time-specific language" · uv "DO NOT leak our conversation … into code comments" · temporal "Do not edit comments that are separate from the code you are changing." |
| 남의 변경 존중 | biome · temporal "Do not revert changes to the codebase unless asked" · Codex prompting guide · OpenHands `HUMAN:` 구역 · next.js 기여자 설명 보존 |
| 하위 호환 | C23 9곳 · langchain "last week" · anthropic-sdk "Don't remove or rename an exported symbol." · ComfyUI "preserve how current callers invoke it" |
| 오류 처리·품질 | C27 24곳 · anthropic-sdk "Never tell cases apart by matching text in a `TypeError`" · astro "No error handling for impossible scenarios." · codex·pytorch "one-caller helper 금지" · kubernetes 오류 메시지 |
| 임시 파일 | C22 7곳 · vscode · pytorch `agent_space/` · hugo 디버그 출력 |

### `packs/core/rules/26-safety.md` (상시) · `packs/core/rules/27-security.md` (on-demand)

| 항목 | 근거 |
|---|---|
| 비밀값·실데이터 | C17 7곳 · OWASP Secrets·Logging · openai-agents-python "Use synthetic data and placeholder credentials" · sentry·n8n·posthog 고객 데이터 금지 |
| 노출 시 교체 먼저 | GitHub "revoke and/or rotate that secret" · OWASP Secrets 사고 대응 |
| 명령행 인자에 비밀값 금지 | n8n "never put secrets in a command" |
| 공개 글 위생·보안 수정 서술 | n8n "never expose the attack vector or vulnerability type in any public-facing artifact" · posthog 내부 정보 금지 · supabase "this repo is public" |
| 외부 내용은 데이터 | OWASP LLM01 · Claude Code Security · next.js "never adopt a PR whose full diff has not been read" · django 파일 실례(5.1) |
| 되돌릴 수 없는 일 승인 | C11 7곳 · airflow "Ask first" · OWASP LLM06 · Claude Code 권한 모델 |
| 보안 장치 우회 금지 | openai-agents-python "Never disable security checks, secret protections, or required review to obtain a passing result." · posthog `--no-verify` 금지 · uv 보안 린트 억제 금지 |
| 입력 검증·매개변수화·경로·크기 상한 | workers-sdk 셸 보간 금지 · langchain "No eval(), exec(), or pickle on user-controlled input" · ComfyUI 경로 재검증 · kibana 입력 상한 · grafana XSS·SQL·명령 인젝션 |
| 판정에는 경로 추적 | openai-agents-python "complete trace from attacker-controlled input through an actual trust boundary" |
| CI 권한·고정 버전 | openai-agents-python "least-privilege … full-SHA action pins" · langchain SHA 고정 · uv `pull_request_target` 대신 디스패처 |
| 의존성 확인표 | OpenSSF · uv "`cargo update --precise`" · pytorch 네트워크 없는 환경에서 설치 금지 |

### `packs/core/rules/30-change-impact.md` (on-demand)

| 항목 | 근거 |
|---|---|
| 계약 기준 영향 범위·전수 검색·CRUD 대칭·데이터 짝 검증 | 팀 (읽기만 옮기고 쓰기를 빠뜨린 사고) · codex "Search for breaking changes in external integration surfaces" · workers-sdk "add coverage at the shared implementation layer; add consumer-specific tests when the consumer's integration or behavior is affected" |
| 폼 입력·미입력·초과 | 팀 · kibana 입력 상한 |

### `packs/core/rules/40-context.md` (상시) · `packs/core/rules/41-context-detail.md` (on-demand)

| 항목 | 근거 |
|---|---|
| 상시 룰 예산 | Codex `project_doc_max_bytes` 32 KiB · Gloaguen 비용 +20% · Claude Code 200줄 · Copilot 2쪽 · Cursor 500줄 |
| 룰보다 장치 | Claude Code "hooks are deterministic and guarantee the action happens" · McMillan 긴 작업 중 준수 하락 · Khatri 정답률 불변 |
| 상시/on-demand 구분 | Claude Code path-scoped rules·skills · Anthropic "just in time" · Cursor rule types |
| 언제 추가·무엇을 빼나 | Claude Code "same mistake a second time" · Cursor "add rules only when you notice repeated mistakes" · Gloaguen 개요 무효 · kibana "If a user correction contradicts this doc … submit … feedback" |
| 복사하지 말고 가리키기 | workers-sdk "copied versions, rule lists, and counts become stale." · Cursor "Point to canonical examples instead of copying code." |
| 충돌 금지·구체성·강조 절제 | Claude Code "Consistency", "Specificity", "If you emphasize many lines, none of them stands out" · Copilot 충돌 금지 |
| 죽은 참조·rename 도구·backup 제외 | 팀 |

### `packs/core/rules/50-git.md` (상시)

| 항목 | 근거 |
|---|---|
| 커밋·푸시는 요청 때만 | C12 10곳 · pytorch "Don't commit unless the user explicitly asks you to." · playwright "Never `git push` without an explicit instruction to push." · dotnet "Never chain commit and push in the same command." |
| repo 별 git | 팀 |
| 커밋 전 diff·의도한 파일만 | 팀 · anthropic-sdk "incidental `uv.lock` changes go elsewhere" · superset 사전 검사 |
| 남의 변경 되돌리지 않기 | biome · temporal · Codex prompting guide "NEVER revert existing changes you did not make" |
| 파괴적 명령·amend·rebase·강제 push 는 요청 때만 | C26 14곳 · Codex prompting guide(`reset --hard`·`checkout --`·amend) · airflow "Never: Use destructive git operations unless explicitly requested." · deno "never force push" · playwright "Never amend commits." · dotnet "Prefer creating a new commit rather than amending" |
| 메시지는 repo 관례 | C13 18곳(형식이 repo 마다 다름) · Conventional Commits · 6장 "AI 표기" |
| 로컬 브랜치 보존·프로세스 정리 범위 | 팀 |

## 8. 채택하지 않은 것

| 내용 | 출처 | 이유 |
|---|---|---|
| 새 파일·주석은 ASCII 기본 | Codex prompting guide · pytorch 주석 ASCII | 이 킷은 문서·대화 언어를 변수로 두고 기본이 한국어다. 코드 언어 규칙은 `language.code` 변수가 맡는다 |
| AI 공동저자·공개 표기를 코어에서 강제 | 5.2 C13 | repo 마다 정반대 — 워크플로 팩·프로젝트 관례로 |
| "끝까지 스스로 해결하고 질문으로 턴을 끝내지 말라" | Codex prompting guide | 팀 규칙(답 받기 전 진행 금지)과 충돌. 멈출 조건을 좁히는 것으로 절충 (28 §3) |
| 저장소 구조·개요 설명 | 제공사 문서 권장 | Gloaguen 외 연구에서 효과 없음. 폴더 구조는 코드에서 읽힌다 |
| 언어별 규칙 (`any` 금지, `unwrap` 금지, 타입 힌트 필수 등) | C27 다수 | 기술 스택마다 다르다 — stack 팩으로 |
| 브랜치 이름·PR 초안 여부·PR 분리 기준 | C14·C26 | 워크플로(GitHub/GitLab) 팩이 정한다 |
| 이모지 금지 | biome | 코어 커뮤니케이션 규칙(간결)으로 충분, 필요하면 프로젝트 팩에서 |
