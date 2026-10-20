# 예산

Codex 는 `AGENTS.md` 를 `project_doc_max_bytes`(기본 32KB)에서 자른다. 잘린 뒤쪽 룰은 조용히 사라지므로
한도를 넘으면 sync 가 `.codex/config.toml` 의 `project_doc_max_bytes` 를 자동으로 올리고 큰 절을 경고한다 (96KB 까지, Claude 는 한도 없음). 그래도 always 룰을 on-demand 로 내리는 것이 context 를 아끼는 길이다. 한도를 직접 정하려면 `workspace.json` 의 `limits.agentsMdBytes`.
