"""워크스페이스 루트·workspace.json 을 읽는 공용 헬퍼 (Python 도구용, workspace.js 와 같은 규칙).
사용: sys.path.insert(0, <packs/core/lib>); from workspace import load; ws = load()"""
import json
import os
import subprocess


def root(start=None):
    env = os.environ.get("CLAUDE_PROJECT_DIR")
    if env and os.path.exists(os.path.join(env, "workspace.json")):
        return env
    d = os.path.abspath(start or os.getcwd())
    while True:
        if os.path.exists(os.path.join(d, "workspace.json")):
            return d
        up = os.path.dirname(d)
        if up == d:
            break
        d = up
    try:
        return subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True, check=True).stdout.strip()
    except Exception:
        return os.getcwd()


def repo_rel(x):
    """repo 폴더 (워크스페이스 기준): repos/<이름>, group 이 있으면 repos/<그룹>/<이름>. bin/kit.js repoRel 과 한 쌍"""
    return "/".join(["repos"] + ([x["group"]] if x.get("group") else []) + [x["name"]])


def load(start=None):
    r = root(start)
    with open(os.path.join(r, "workspace.json"), encoding="utf-8") as f:
        ws = json.load(f)
    ws["root"] = r
    repos = []
    for x in ws.get("repos", []):
        link = os.path.join(r, repo_rel(x))
        d = link if os.path.exists(link) or not x.get("path") else os.path.abspath(os.path.join(r, x["path"]))
        repos.append({**x, "dir": d})
    ws["repos"] = repos
    for x in repos:
        x.setdefault("kind", "code")
    legacy = next((x for x in repos if x["kind"] == "legacy"), None)
    asis = ws.setdefault("vars", {}).get("asis")
    if legacy and isinstance(asis, dict) and not asis.get("sourceRoot"):
        asis["sourceRoot"] = os.path.join(repo_rel(legacy), legacy.get("sourceRoot", ""))
    return ws


def var(ws, key, default=None):
    cur = ws.get("vars", {})
    for part in key.split("."):
        if not isinstance(cur, dict) or part not in cur:
            return default
        cur = cur[part]
    return cur
