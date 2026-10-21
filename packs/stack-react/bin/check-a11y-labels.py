#!/usr/bin/env python3
# React 프론트 라벨·컨트롤 접근성 정적 검사 (eslint jsx-a11y 사각지대). 실행: python3 packs/stack-react/bin/check-a11y-labels.py [--quiet] [--repo <경로>]
"""eslint 의 jsx-a11y/label-has-associated-control 은 라벨 안에 JSX 표현식이 하나라도 있으면
(`{' '}` 포함) 무조건 통과시킨다 — mayContainChildComponent 가 JSXExpressionContainer 를
컨트롤로 간주하기 때문이다. 이 스크립트가 그 사각지대와 이름 누락을 본다.

검사 4종
  ① 연결 안 된 라벨 — htmlFor 도 없고 안에 컨트롤도 없는 <label>
  ② 이름 없는 컨트롤 — 자기 이름(id·aria-label·aria-labelledby)도 없고, 이름을 주는
     조상(<label> · aria-labelledby 를 단 요소 · 이름 래퍼) 안에도 있지 않은 입력 요소
  ③ 이름 없는 버튼·링크 — 아이콘뿐이거나 조건·삼항으로 이름이 사라질 수 있는 것
  ④ 중첩된 클릭 요소 — 드롭다운 토글(renderTitle) 안의 버튼처럼 같은 자리에 탭 정지를 2개 만드는 것

대상 repo: --repo <경로> > workspace.json vars.react.repo > stack 에 react 가 들어간 첫 repo.
프로젝트 설정(workspace.json vars.react.a11y): controls · namingWrappers · forwardingPattern · skipDirs.
위반 0 이면 exit 0, 있으면 목록 출력 후 exit 1. 대상 repo 를 못 찾으면 건너뜀(exit 0, --repo 를 줬으면 2).
"""
import json
import os
import re
import sys



def find_workspace():
    """workspace.json 이 있는 폴더 (현재 폴더에서 위로)."""
    d = os.path.abspath(os.getcwd())
    while True:
        if os.path.isfile(os.path.join(d, 'workspace.json')):
            return d
        up = os.path.dirname(d)
        if up == d:
            return None
        d = up


def resolve_repo(argv):
    """(repo 경로 | None, vars.react 설정, 사유)."""
    ws_root = find_workspace()
    ws = {}
    if ws_root:
        with open(os.path.join(ws_root, 'workspace.json'), encoding='utf-8') as f:
            ws = json.load(f)
    cfg = (ws.get('vars') or {}).get('react') or {}
    if '--repo' in argv:
        i = argv.index('--repo')
        if i + 1 < len(argv):
            return os.path.abspath(argv[i + 1]), cfg, None
    if not ws_root:
        return None, cfg, 'workspace.json 을 찾지 못했다 (--repo <경로> 로 지정)'
    repos = ws.get('repos') or []
    want = cfg.get('repo') or ''
    pick = next((r for r in repos if (r.get('name') == want if want else re.search('react', str(r.get('stack', '')), re.I))), None)
    if not pick:
        return None, cfg, (f"vars.react.repo '{want}' 가 repos 에 없다" if want
                           else 'stack 에 react 가 들어간 repo 가 없다 (vars.react.repo 로 지정)')
    linked = os.path.join(ws_root, 'repos', *([pick['group']] if pick.get('group') else []), pick['name'])
    if os.path.isdir(linked):
        return linked, cfg, None
    if pick.get('path') and os.path.isdir(os.path.join(ws_root, pick['path'])):
        return os.path.normpath(os.path.join(ws_root, pick['path'])), cfg, None
    return None, cfg, f"{pick['name']} 경로가 없다 (aidure install 또는 repos[].path 확인)"


ROOT, CFG, WHY = resolve_repo(sys.argv[1:])
A11Y = CFG.get('a11y') or {}

# 실제 폼 컨트롤을 렌더하는 것들. 프로젝트 공용 입력 컴포넌트는 vars.react.a11y.controls 에 더한다.
CONTROLS = tuple(dict.fromkeys((
    'input', 'textarea', 'select',
    'Input', 'PasswordInput', 'Select',
    'DatePicker', 'DatePicker.DateTimepicker', 'DatePicker.DatePickerRange',
    'TimeInput', 'Switcher', 'Checkbox', 'Radio',
) + tuple(A11Y.get('controls') or ())))
# 자식 텍스트가 곧 이름인 것들 — <Radio value="ON">On</Radio>
SELF_LABELLING = ('Checkbox', 'Radio')
# 캡션을 직접 렌더하고 그 이름을 자식 컨트롤에 연결해 주는 공용 래퍼
NAMING_WRAPPERS = tuple(dict.fromkeys(('label', 'FormItem') + tuple(A11Y.get('namingWrappers') or ())))
# 눌리는 것들 — 안에 글자가 없으면 스크린리더가 "버튼" 으로만 읽는다
CLICKABLES = ('button', 'a', 'Button', 'IconButton', 'Link', 'CloseButton')
# 자식이 아이콘(react-icons / svg)뿐이면 이름이 되지 않는다
ICON = r'<(?:Pi|Hi|Ri|Fa|Md|Io|Bs|Tb|Lu)\w*\s*/>|<svg[^>]*/>'
# 조건부 자식 — `{showTitle && <span>…</span>}` 은 조건이 거짓이면 이름이 사라진다.
# 접힌 사이드 메뉴가 흔한 예다 — 스크린리더는 href 를 이름으로 읽는다.
CONDITIONAL = r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*&&[^{}]*(?:\{[^{}]*\}[^{}]*)*\}'
# 이름이 될 수 있는 자식이 하나도 없는 상태
NO_NAME_SOURCE = re.compile(
    r'^(?:\s|' + ICON + r'|' + CONDITIONAL + r')*$', re.S
)
# 삼항 자식 — `{on ? <아이콘/> : <></>}` 처럼 글자가 없는 분기가 있으면 그 분기에서 이름이 사라진다.
# 양쪽 다 글자면(`{busy ? 'Saving' : 'Save'}`) 이름이 되므로 대상이 아니다.
TERNARY = re.compile(
    r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\?[^{}]*:[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', re.S
)
# 글자를 내지 않는 분기 — 아이콘 · 빈 조각 · null/undefined · 공백
BRANCH_NO_TEXT = re.compile(
    r'^\s*(?:\(\s*\)?\s*)?(?:' + ICON + r'|<>\s*</>|<React\.Fragment\s*/>|null|undefined)\s*\)?\s*$',
    re.S,
)


def ternary_gives_text(expr):
    """`{cond ? A : B}` 의 모든 분기가 글자를 내는가."""
    inner = expr[1:-1]
    q = inner.find('?')
    if q < 0:
        return True
    rest = inner[q + 1:]
    depth = 0
    for i, c in enumerate(rest):
        if c == '?':
            depth += 1
        elif c == ':':
            if depth == 0:
                branches = [rest[:i], rest[i + 1:]]
                return not any(BRANCH_NO_TEXT.match(b) for b in branches)
            depth -= 1
    return True
# 이름을 caller 에게서 받아 그대로 넘기는 래퍼 — 그 파일 안에서는 이름을 요구하지 않는다.
# 기본 UI 컴포넌트 폴더 + vars.react.a11y.forwardingPattern.
FORWARDING = re.compile(
    r'components[/\\]ui[/\\]' + ('|' + A11Y['forwardingPattern'] if A11Y.get('forwardingPattern') else '')
)
SKIP_DIRS = tuple(A11Y.get('skipDirs') if A11Y.get('skipDirs') is not None else ('api',))

TAG = re.compile(r'<(/?)([A-Za-z][\w.]*)(<[^<>]*>)?')
NAMED_SELF = re.compile(r'\b(id|inputId|aria-label|aria-labelledby|ariaLabel)\s*=')
SPREAD = re.compile(r'\{\s*\.\.\.')


def tag_end(s, i):
    """여는 태그의 '>' 위치. 중괄호 표현식과 문자열 안의 '>' 는 건너뛴다."""
    depth, quote = 0, None
    while i < len(s):
        c = s[i]
        if quote:
            if c == quote:
                quote = None
        elif c in '"\'':
            quote = c
        elif c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
        elif c == '>' and depth == 0:
            return i
        i += 1
    return -1


def blank_comments(s):
    """주석 안의 <label> 같은 글자가 위반으로 잡히지 않게 공백으로 치환(길이 보존)."""
    out = list(s)
    for m in re.finditer(r'//[^\n]*|/\*.*?\*/', s, re.S):
        for i in range(m.start(), m.end()):
            if out[i] != '\n':
                out[i] = ' '
    return ''.join(out)


def walk(s):
    """(태그명, 시작, 여는태그끝, 속성, 조상목록) 을 열리는 순서대로 낸다.

    JSX 는 항상 균형이 맞으므로 태그 스택만으로 조상을 알 수 있다. 조상은
    (태그명, 속성) 튜플 목록이다.
    """
    stack = []
    i = 0
    while True:
        m = TAG.search(s, i)
        if not m:
            return
        e = tag_end(s, m.end())
        if e < 0:
            return
        name, closing = m.group(2), m.group(1) == '/'
        attrs = s[m.end():e]
        if closing:
            for k in range(len(stack) - 1, -1, -1):
                if stack[k][0] == name:
                    del stack[k:]
                    break
        else:
            yield name, m.start(), e, attrs, list(stack)
            if s[e - 1] != '/':
                stack.append((name, attrs))
        i = e + 1


def scan(rel, s):
    unlinked, unnamed, nameless, nested = [], [], [], []
    forwarding = bool(FORWARDING.search(rel))

    for name, start, end, attrs, ancestors in walk(s):
        if name == 'label' and not re.search(r'\bhtmlFor\s*=', attrs):
            close = s.find('</label>', end)
            body = s[end + 1:close] if close > 0 else ''
            if not any(re.search(r'<' + re.escape(c) + r'(?![\w.])', body) for c in CONTROLS):
                text = ' '.join(re.sub(r'<[^>]*>|\{[^{}]*\}', ' ', body).split())
                unlinked.append((s.count('\n', 0, start) + 1, text[:40] or '(no text)'))

        if name not in CONTROLS or forwarding:
            continue
        if NAMED_SELF.search(attrs) or SPREAD.search(attrs):
            continue
        # 이름을 주는 조상 안에 있으면 그 조상이 이름이다
        if any(a in NAMING_WRAPPERS or 'aria-labelledby' in at or 'aria-label' in at
               for a, at in ancestors):
            continue
        # 자식을 가진 Checkbox/Radio 는 그 자식이 이름이다 — 글자든 라벨 컴포넌트든
        if name in SELF_LABELLING and s[end - 1] != '/':
            close = s.find(f'</{name}>', end)
            if close > 0 and s[end + 1:close].strip():
                continue
        unnamed.append((s.count('\n', 0, start) + 1, name))

    # Dropdown 의 renderTitle 은 토글(<button>) 안에 들어간다 — 거기 버튼을 또 넣으면 같은
    # 자리에 탭 정지가 2개 생긴다. 여는 태그의 속성 안이라 태그 스택으로는 안 보인다.
    for m in re.finditer(r'renderTitle=\{', s):
        i, depth = m.end(), 1
        while i < len(s) and depth:
            if s[i] == '{':
                depth += 1
            elif s[i] == '}':
                depth -= 1
            i += 1
        inner = s[m.end():i]
        b = re.search(r'<(button|Button|IconButton)(?![\w.])([^>]*)', inner)
        # asElement 로 버튼이 아닌 것을 렌더하면 중첩이 아니다
        if b and not re.search(r'asElement=\{?["\']?(?!button)', b.group(2)):
            nested.append((s.count('\n', 0, m.start()) + 1, b.group(1)))

    if not forwarding:
        for name, start, end, attrs, ancestors in walk(s):
            if name not in CLICKABLES:
                continue
            if NAMED_SELF.search(attrs) or SPREAD.search(attrs):
                continue
            if re.search(r'\btitle\s*=', attrs):
                continue
            # IconButton interactive={false} 는 <span> 을 렌더한다 — 눌리는 것이 아니다
            if name == 'IconButton' and re.search(r'interactive=\{false\}', attrs):
                continue
            if s[end - 1] == '/':          # 자식이 아예 없다
                nameless.append((s.count('\n', 0, start) + 1, name))
                continue
            close = s.find(f'</{name}>', end)
            if close < 0:
                continue
            body = s[end + 1:close]
            # 이름이 사라질 수 있는 삼항은 이름 원천으로 치지 않는다
            body = TERNARY.sub(
                lambda m: 'x' if ternary_gives_text(m.group(0)) else ' ', body
            )
            if NO_NAME_SOURCE.match(body):
                nameless.append((s.count('\n', 0, start) + 1, name))
    return unlinked, unnamed, nameless, nested


def main():
    quiet = '--quiet' in sys.argv
    if not ROOT:
        print(f'건너뜀 — 프론트 repo 를 찾지 못했다: {WHY}')
        return 2 if '--repo' in sys.argv else 0
    src = os.path.join(ROOT, CFG.get('srcDir') or 'src')
    if not os.path.isdir(src):
        print(f'건너뜀 — 소스 폴더가 없다 ({src})')
        return 2 if '--repo' in sys.argv else 0
    files = 0

    total_unlinked, total_unnamed, total_nameless, total_nested = 0, 0, 0, 0
    for dirpath, dirnames, names in os.walk(src):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for n in sorted(names):
            if not n.endswith('.tsx'):
                continue
            path = os.path.join(dirpath, n)
            files += 1
            rel = os.path.relpath(path, ROOT)
            with open(path, encoding='utf-8') as fh:
                unlinked, unnamed, nameless, nested = scan(rel, blank_comments(fh.read()))
            total_unlinked += len(unlinked)
            total_unnamed += len(unnamed)
            total_nameless += len(nameless)
            total_nested += len(nested)
            if quiet:
                continue
            for line, text in unlinked:
                print(f'{rel}:{line}  라벨이 컨트롤과 이어지지 않음 — {text}')
            for line, tag in unnamed:
                print(f'{rel}:{line}  <{tag}> 에 이름이 없음 (htmlFor 연결 · aria-label 중 하나 필요)')
            for line, tag in nameless:
                print(f'{rel}:{line}  <{tag}> 가 아이콘뿐이라 이름이 없음 (aria-label 필요)')
            for line, tag in nested:
                print(f'{rel}:{line}  <{tag}> 가 Dropdown 토글 안에 있음 — 탭 정지가 2개가 된다'
                      f' (<span> 으로 바꾸고 이름은 <Dropdown aria-label>)')

    if total_unlinked or total_unnamed or total_nameless or total_nested:
        print(f'\n✗ ({files}파일) 연결 안 된 라벨 {total_unlinked} · 이름 없는 컨트롤 {total_unnamed}'
              f' · 이름 없는 버튼/링크 {total_nameless} · 중첩 클릭 요소 {total_nested}')
        print('  보이는 라벨이 있으면 htmlFor + id(react-select 는 inputId),')
        print('  라벨이 없으면 aria-label, 묶음이면 role="group" + aria-labelledby.')
        print('  상세: packs/stack-react/docs/react-a11y.md')
        return 1
    if files == 0:
        print(f'⚠ 검사 대상 .tsx 0개 — {src} 를 확인하라')
        return 0
    print(f'✓ 라벨·컨트롤 접근성 정상 ({files}파일) — 연결 안 된 라벨 0 · 이름 없는 컨트롤 0'
          ' · 이름 없는 버튼/링크 0 · 중첩 클릭 요소 0')
    return 0


if __name__ == '__main__':
    sys.exit(main())
