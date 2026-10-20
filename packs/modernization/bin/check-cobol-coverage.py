#!/usr/bin/env python3
"""COBOL 단락의 실행 분기·SQL·커서를 세어 AS-IS 대조 문서의 수치를 검증한다.

대조 문서를 쓸 때 사람이 손으로 세던 것을 기계가 대신 센다. 손으로 세면 `END-IF` 를
`IF` 로 세거나 단락 하나를 빠뜨리는 일이 생기고, 그 숫자는 아무도 다시 세지 않아 오래 남는다.

  # 갈래별 계수 — 문서의 `IF` 수와 대조한다
  python3 packs/modernization/bin/check-cobol-coverage.py prog.cbl --from 0409 --to 0442

  # 업무 분기 전수 목록 — 그대로 대조 체크리스트가 된다
  python3 packs/modernization/bin/check-cobol-coverage.py prog.cbl --paragraphs 0435,0436 --list

  # 죽은 단락·죽은 커서 — 대조 대상에서 빼야 하는 것
  python3 packs/modernization/bin/check-cobol-coverage.py prog.cbl --dead

<source> 는 경로이거나 workspace.json vars.asis.sourceRoot 기준 상대 경로·파일명이다.

판정 규칙 (코볼 고정 형식)
  * 7번지(인덱스 6)가 `*` 또는 `D` 면 주석·디버그라 실행 코드가 아니다. 1~6번지의
    `!`·일련번호는 코드 여부와 무관하다.
  * 코드는 8~72번지만 본다. 73번지부터는 일련번호라 그 안의 글자는 세지 않는다.
  * `END-IF` 는 `IF` 가 아니다. 식별자 안의 IF(`NOT-IF-X`)도 아니다.
  * `EXEC SQL` 은 `EXEC` 와 `SQL` 사이 공백이 두 칸인 문장이 섞여 있어 `EXEC +SQL` 로 센다.
"""

import argparse
import re
import sys
from pathlib import Path

# 7번지 지시자 — 공백과 계속(-)만 실행 코드다.
LIVE_INDICATORS = {" ", "-"}

# 단락 라벨: 8번지에서 시작하고 마침표로 끝난다. 1~6번지(일련번호 칸)는 무엇이 있든 상관없다.
# 단락 라벨은 A 영역(8~11번지)에서 시작한다 — 12번지부터는 문장이라 이어지는 줄이 라벨로 잡히지 않는다.
# `X-EXIT.  EXIT.` 처럼 라벨과 EXIT 가 한 줄에 오는 소스가 있어 그것도 받는다.
PARAGRAPH = re.compile(
    r"^ {0,3}([A-Z0-9][A-Z0-9-]*)(\s+SECTION)?\s*\.\s*(?:EXIT\s*\.)?\s*\d*\s*$"
)

# 라벨이 SECTION 인지 — 섹션 안에서는 단락이 차례로 흘러간다.
SECTION_LABEL = {}

# PERFORM a [THRU b] · GO TO a · SORT ... INPUT/OUTPUT PROCEDURE a — 호출 사슬의 간선.
PERFORM_RANGE = re.compile(
    r"\bPERFORM\s+([A-Z0-9][A-Z0-9-]*)(?:\s+THRU\s+([A-Z0-9][A-Z0-9-]*))?"
)
GOTO_TARGET = re.compile(r"\bGO\s+TO\s+([A-Z0-9][A-Z0-9-]*)")
SORT_PROCEDURE = re.compile(r"\b(?:INPUT|OUTPUT)\s+PROCEDURE\s+([A-Z0-9][A-Z0-9-]*)")

# 식별자 안의 IF 와 END-IF 를 뺀 IF 문.
IF_WORD = re.compile(r"(?<![-A-Z])IF(?![-A-Z])")

# 홀로 마침표를 달고 나오는 코볼 예약어 — 라벨처럼 생겼지만 단락이 아니다.
RESERVED_LABELS = {
    "EXIT", "CONTINUE", "GOBACK", "END-IF", "END-EVALUATE", "END-PERFORM", "END-READ",
    "END-CALL", "END-SEARCH", "END-STRING", "END-UNSTRING", "END-COMPUTE", "END-ADD",
    "END-SUBTRACT", "END-MULTIPLY", "END-DIVIDE", "END-START", "END-WRITE", "END-REWRITE",
    "END-DELETE", "END-RETURN", "END-EXEC",
}

EXEC_SQL = re.compile(r"EXEC +SQL")
CURSOR_VERB = re.compile(r"\b(DECLARE|OPEN|FETCH|CLOSE)\s+([A-Z][A-Z0-9-]*)")


def code_area(line: str) -> str:
    """실행 코드 영역(8~72번지)만 돌려준다. 주석·디버그 줄은 빈 문자열."""
    if len(line) < 8 or line[6] not in LIVE_INDICATORS:
        return ""
    return line[7:72]


def load(path: Path) -> list[str]:
    # AS-IS 소스에는 ISO-8859 바이트가 섞여 있어 latin-1 로 읽는다.
    return path.read_text(encoding="latin-1").split("\n")


def paragraphs(lines: list[str]) -> list[tuple[int, str]]:
    """(줄번호, 단락명) 목록. 주석 처리된 라벨은 제외된다."""
    started = False
    found = []
    for index, line in enumerate(lines):
        if line[6:7] not in LIVE_INDICATORS:
            continue
        if not started:
            # PROCEDURE DIVISION 앞의 라벨(FILE-CONTROL 등)은 단락이 아니다.
            started = "PROCEDURE DIVISION" in line[7:]
            continue
        # 8번지부터 본다 — 1~6번지에 `!`·`AMG` 같은 글자가 있어도 살아 있는 단락이다.
        match = PARAGRAPH.match(line[7:])
        if match and match.group(1) not in RESERVED_LABELS:
            SECTION_LABEL[match.group(1)] = bool(match.group(2))
            found.append((index, match.group(1)))
    return found


def helper_labels(lines: list[str], labels: list[tuple[int, str]]) -> set:
    """단락 안에서 `GO TO` 목적지로만 쓰는 보조 라벨.

    `SKIP-ROW` 처럼 어디서도 PERFORM 하지 않고 그 자리에서 건너뛰기용으로만 쓰는 라벨이다.
    이런 라벨에서 구간을 끊으면 그 뒤 분기가 통째로 빠지므로 앞 단락에 붙여 센다.
    """
    performed, jumped = set(), set()
    for line in lines:
        body = code_area(line)
        if not body:
            continue
        for target, thru in PERFORM_RANGE.findall(body):
            performed.add(target)
            if thru:
                performed.add(thru)
        jumped.update(GOTO_TARGET.findall(body))
    names = {nm for _, nm in labels}
    return {nm for nm in names if nm in jumped and nm not in performed}


def span(lines: list[str], labels: list[tuple[int, str]], name: str, helpers=None) -> range:
    """한 단락이 차지하는 줄 범위 — 다음 라벨까지다.

    보조 라벨(위 helper_labels)에서는 끊지 않고 이어 붙인다. 번호 접두어로 묶으면
    `100-GET-DATA` 가 `100-MAIN-PROCESS` 까지 삼켜 구간이 겹치고 두 번 세어진다.
    """
    order = [n for n, _ in labels]
    start = next((n for n, nm in labels if nm == name), None)
    if start is None:
        return range(0, 0)
    if helpers is None:
        helpers = helper_labels(lines, labels)
    index = order.index(start)
    for step in range(index + 1, len(labels)):
        if labels[step][1] not in helpers:
            return range(start, labels[step][0])
    return range(start, len(lines))


def scan(lines: list[str], rows: range) -> dict:
    """한 단락의 실행 분기·SQL·커서 동사를 센다."""
    business, sqlcode, sqls, cursors = [], [], [], []
    for index in rows:
        body = code_area(lines[index])
        if not body:
            continue
        if EXEC_SQL.search(body):
            sqls.append(index + 1)
        for verb, cursor in CURSOR_VERB.findall(body):
            cursors.append((verb, cursor))
        # END-IF 를 지운 뒤에 남는 IF 만 분기다.
        if IF_WORD.search(re.sub(r"END-IF", "", body)):
            entry = (index + 1, body.strip())
            (sqlcode if "SQLCODE" in body else business).append(entry)
    return {"business": business, "sqlcode": sqlcode, "sqls": sqls, "cursors": cursors}


def is_called(lines: list[str], name: str, own: range) -> bool:
    """그 단락을 부르는 PERFORM/GO TO 가 자기 밖에 있는가."""
    for index, line in enumerate(lines):
        if index in own:
            continue
        body = code_area(line)
        if body and re.search(rf"(PERFORM|GO\s+TO)\s+{re.escape(name)}\b", body):
            return True
    return False


def reachable(lines, labels):
    """진입점부터 호출 사슬을 따라가 실제로 도달하는 단락을 모은다.

    한 단락만 보는 is_called 과 달리 두 단계 위가 주석인 경우까지 잡는다.
    PERFORM 이 여러 줄에 걸쳐 THRU 를 다음 줄에 두는 일이 잦아 단락 본문을 이어 붙여 훑는다.
    """
    # PROCEDURE DIVISION 과 첫 라벨 사이에도 문장이 온다 — 그 자리가 곧 진입점인 소스가 많다.
    # 이름이 없어 단락 목록에 안 잡히므로 가짜 노드를 하나 세운다.
    DRIVER = "(PROCEDURE DIVISION)"
    head = 0
    for index, line in enumerate(lines):
        if line[6:7] in LIVE_INDICATORS and "PROCEDURE DIVISION" in line[7:]:
            head = index
            break
    first = labels[0][0] if labels else len(lines)

    order = [DRIVER] + [nm for _, nm in labels]
    where = {nm: i for i, nm in enumerate(order)}

    def owner(index):
        if head <= index < first:
            return DRIVER
        found = None
        for line_no, name in labels:
            if line_no <= index:
                found = name
            else:
                break
        return found

    bodies = {nm: [] for nm in order}
    for index, line in enumerate(lines):
        body = code_area(line)
        if not body:
            continue
        here = owner(index)
        if here is not None:
            bodies[here].append(body)

    # 섹션에 속한 단락들 — 섹션을 PERFORM 하면 그 안이 통째로 돈다.
    members = {}
    current = None
    for name in order:
        if SECTION_LABEL.get(name):
            current = name
            members[current] = []
        if current:
            members[current].append(name)

    # 간선은 두 갈래다. CALL 은 부른 곳으로 돌아가므로 그 단락에서 낙하하지 않고,
    # FLOW 는 순차 실행이라 다음 단락으로 이어진다. GO TO 는 돌아오지 않으므로 FLOW 다.
    calls = {nm: set() for nm in order}
    flows = {nm: set() for nm in order}
    for name in order:
        joined = " ".join(bodies[name])
        for target, thru in PERFORM_RANGE.findall(joined):
            if target not in where:
                continue
            if thru and thru in where:
                for step in range(where[target], where[thru] + 1):
                    calls[name].add(order[step])
            elif SECTION_LABEL.get(target):
                calls[name].update(members.get(target, [target]))
            else:
                calls[name].add(target)
        for target in GOTO_TARGET.findall(joined):
            if target in where:
                # GO TO 는 돌아오지 않지만, 그 뒤로 낙하를 무한정 이어가면 파일 전체가
                # 살아 있는 것으로 나온다. 도착 단락만 살리고 낙하는 잇지 않는다.
                calls[name].add(target)
        for target in SORT_PROCEDURE.findall(joined):
            if target in where:
                calls[name].update(
                    members.get(target, [target]) if SECTION_LABEL.get(target) else [target]
                )

    stops = {
        nm: any(re.search(r"\b(STOP\s+RUN|GOBACK)\b", st) for st in bodies[nm]) for nm in order
    }

    # 진입점 — PROCEDURE DIVISION 바로 아래. 거기가 비어 있으면 첫 단락이 진입점이다.
    entry = DRIVER if bodies[DRIVER] or len(order) == 1 else order[1]

    FLOW, CALL = 0, 1
    state = {(entry, FLOW)}
    stack = [(entry, FLOW)]
    while stack:
        name, mode = stack.pop()
        nexts = [(x, CALL) for x in calls[name]] + [(x, FLOW) for x in flows[name]]
        # 낙하는 순차 실행으로 들어온 단락에서만 이어진다.
        if mode == FLOW and not stops[name]:
            i = where[name]
            if i + 1 < len(order):
                nexts.append((order[i + 1], FLOW))
        for nxt in nexts:
            if nxt not in state:
                state.add(nxt)
                stack.append(nxt)
    return {nm for nm, _ in state}, entry


def select(labels: list[tuple[int, str]], args, helpers=frozenset()) -> list[str]:
    """--paragraphs 또는 --from/--to 로 대상 단락을 고른다.

    EXIT 라벨과 보조 라벨은 뺀다 — 보조 라벨은 앞 단락 구간에 이미 들어가 있어서,
    따로 세면 같은 줄을 두 번 센다.
    """
    names = [
        nm
        for _, nm in labels
        if not nm.endswith(("-EXIT", "-EX")) and nm not in helpers
    ]
    if args.paragraphs:
        wanted = [p.strip() for p in args.paragraphs.split(",") if p.strip()]
        picked: list[str] = []
        for want in wanted:
            # 접두어가 겹칠 수 있어(0437 ↔ 0437A) 번호 부분이 정확히 같은 것만 고른다.
            hits = [nm for nm in names if nm.split("-")[0] == want] or [
                nm for nm in names if nm.startswith(want)
            ]
            if not hits:
                print(f"  경고 — 단락을 못 찾았다: {want}", file=sys.stderr)
            picked.extend(nm for nm in hits if nm not in picked)
        return picked
    if args.start and args.end:
        return [nm for nm in names if args.start <= nm.split("-")[0] <= args.end]
    return names


def resolve_source(given: str):
    """경로 그대로 → vars.asis.sourceRoot 기준 → sourceRoot 아래 파일명 검색(유일할 때만)."""
    path = Path(given)
    if path.exists():
        return path
    import json

    here = Path.cwd().resolve()
    root = next((c for c in [here, *here.parents] if (c / "workspace.json").exists()), None)
    if root is None:
        return None
    try:
        asis = json.loads((root / "workspace.json").read_text(encoding="utf-8")).get("vars", {}).get("asis", {})
    except (OSError, ValueError):
        return None
    base = asis.get("sourceRoot")
    if not base:
        return None
    base = Path(base) if Path(base).is_absolute() else root / base
    if (base / given).exists():
        return base / given
    hits = [p for p in base.rglob(Path(given).name) if p.is_file()]
    if len(hits) == 1:
        return hits[0]
    if len(hits) > 1:
        print("파일명이 여러 곳에 있다 — 경로를 더 주세요:", *hits[:10], sep="\n  ", file=sys.stderr)
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("source", help="코볼 소스 경로 (.cbl)")
    parser.add_argument("--paragraphs", help="쉼표로 구분한 단락 접두어 (예: 0435,0436)")
    parser.add_argument("--from", dest="start", help="시작 단락 번호 (예: 0409)")
    parser.add_argument("--to", dest="end", help="끝 단락 번호 (예: 0442)")
    parser.add_argument("--list", action="store_true", help="업무 분기를 한 줄씩 전부 출력 (대조 체크리스트)")
    parser.add_argument(
        "--dead",
        action="store_true",
        help="도달하지 않는 단락과 죽은 커서를 찾는다 (호출 사슬을 진입점부터 따라간다)",
    )
    args = parser.parse_args()

    path = resolve_source(args.source)
    if path is None:
        print(f"소스를 찾을 수 없다: {path}", file=sys.stderr)
        return 1

    lines = load(path)
    labels = paragraphs(lines)
    helpers = helper_labels(lines, labels)
    targets = select(labels, args, helpers)
    if not targets:
        print("대상 단락이 없다.", file=sys.stderr)
        return 1

    total_business = total_sqlcode = total_sql = 0
    listing = []
    print(f"{'단락':34}{'업무분기':>8}{'SQLCODE':>9}{'EXEC SQL':>10}")
    print("-" * 61)
    for name in targets:
        rows = span(lines, labels, name, helpers)
        result = scan(lines, rows)
        b, s, q = len(result["business"]), len(result["sqlcode"]), len(result["sqls"])
        total_business += b
        total_sqlcode += s
        total_sql += q
        print(f"{name:34}{b:>8}{s:>9}{q:>10}")
        listing.extend((name, ln, text) for ln, text in result["business"])
    print("-" * 61)
    print(f"{'합계':32}{total_business:>8}{total_sqlcode:>9}{total_sql:>10}")
    print(f"\n실행 IF {total_business + total_sqlcode}개 = 업무 분기 {total_business} + 조회 결과 검사 {total_sqlcode}")

    if args.list:
        print(f"\n=== 업무 분기 전수 {len(listing)}개 — 대조 문서가 이 목록을 다 덮어야 한다 ===")
        for name, line_no, text in listing:
            print(f"{name:32}{line_no:>7}  {text[:60]}")

    if args.dead:
        live, entry = reachable(lines, labels)
        print(f"\n=== 도달하지 않는 단락 (진입점 {entry}) ===")
        print("  호출 사슬을 끝까지 따라간 결과다 — 두 단계 위가 주석인 경우도 잡는다.")
        gone = [nm for nm in targets if nm not in live]
        print("  없음" if not gone else "\n".join(f"  {nm}" for nm in gone))

        print("\n=== 참고: 자기를 부르는 곳이 한 곳도 없는 단락 ===")
        print("  한 단계만 본 것이라 진입점·SORT 진입·낙하로 도는 단락도 섞인다.")
        lone = [nm for nm in targets if not is_called(lines, nm, span(lines, labels, nm, helpers))]
        print("  없음" if not lone else "\n".join(f"  {nm}" for nm in lone))

        print("\n=== 커서 — DECLARE 만 있고 OPEN 이 없으면 죽은 커서다 ===")
        verbs: dict[str, dict[str, int]] = {}
        for index, line in enumerate(lines):
            body = code_area(line)
            for verb, cursor in CURSOR_VERB.findall(body) if body else []:
                verbs.setdefault(cursor, {}).setdefault(verb, 0)
                verbs[cursor][verb] += 1
        for cursor, counts in sorted(verbs.items()):
            if "DECLARE" not in counts:
                continue
            mark = "  죽음" if counts.get("OPEN", 0) == 0 else ""
            print(
                f"  {cursor:16} DECLARE {counts.get('DECLARE', 0)}"
                f"  OPEN {counts.get('OPEN', 0)}"
                f"  FETCH {counts.get('FETCH', 0)}"
                f"  CLOSE {counts.get('CLOSE', 0)}{mark}"
            )
    return 0


if __name__ == "__main__":
    sys.exit(main())
