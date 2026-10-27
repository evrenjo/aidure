---
title: Django 기본 규약
load: always
---

## Django 기본 규약

- **업무 로직은 기존 프로젝트가 두는 곳(모델 메서드 · `services.py` · 매니저)을 먼저 찾아 따른다.** 없으면 쓰기는 서비스 함수, 읽기는 선택자 · QuerySet 메서드로 둔다.
- 뷰 · 시리얼라이저 · 폼 · 시그널에 업무 로직을 넣지 않는다. 뷰는 입력 검증 · 호출 · 응답만.
- 모델은 데이터와 그에 붙은 단순 규칙(`clean`, 가벼운 속성)만. 무결성은 DB 제약(`UniqueConstraint`, `CheckConstraint`)으로.
- 모델 멤버 순서: 필드 · 매니저 · `Meta` · `__str__` · `save` · `get_absolute_url` · 기타 메서드. 선택지는 `TextChoices` · `IntegerChoices`.
- 쿼리: 반복문 속 쿼리(N+1) 대신 `select_related` · `prefetch_related`. 여러 쓰기는 `transaction.atomic`.
- 설정은 `django.conf.settings` 로 읽고 모듈 최상단에서 읽지 않는다. 비밀값은 환경 변수.
- 앱은 한 주제씩 작게. 마이그레이션은 생성 후 검토하고, 손으로 고친 것은 되돌릴 수 있게 둔다.
- 사용자에게 보이는 문자열은 번역 표시(`gettext`). 번역 문자열에 f-string 을 쓰지 않는다.
