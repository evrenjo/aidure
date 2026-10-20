#!/usr/bin/env node
// React 프론트 런타임 a11y 검사 — 실제 Tab 순회로 브라우저가 준 암묵 탭 정지·모달 안 닿지 않는 스크롤 영역을 찾는다. 실행: node packs/stack-react/bin/check-a11y-runtime.js [--modals] [--route /x] [--headed] [--quiet] [--repo <경로>]
/**
 * Chrome 127+ 는 스크롤되는 영역에 포커스 가능한 자식이 하나도 없으면 그 영역 자체를 탭 정지로
 * 만든다(keyboard-focusable scrollers). 없애면 안 되지만 소스에 `tabindex` 가 없으므로 정적 검사기
 * (eslint · check-a11y-labels.py)는 이 탭 정지의 존재를 알 수 없다.
 *
 * 판정은 **실제로 Tab 을 눌러 순회**해서 한다. `el.focus()` 가 먹히는지로 보면 안 된다 — 스크롤 영역은
 * 자식이 있든 없든 프로그램 포커스를 받으므로 포커스 가능한 자식이 많은 패널까지 위반으로 잡힌다.
 * 찾은 탭 정지마다 ①이름 ②역할 ③앱의 포커스 표시(focus-ring 클래스)가 있는지 본다.
 *
 * `--modals` 는 본문 버튼을 눌러 드로어·다이얼로그를 열고 그 안에서 다시 Tab 을 순회한다. 이때
 * **인증 요청(authAllowPattern)을 뺀 모든 비-GET 요청을 차단**해 클릭이 데이터를 바꾸지 못하게 한다
 * (전면 차단하면 토큰 갱신이 막혀 세션이 끊긴다).
 *
 * 준비물: 프론트·API 가 떠 있어야 하고 Playwright 가 필요하다.
 * 설정: workspace.json vars.react.a11y — baseUrl · routesFile · excludeRoutes · loginPath · login*Selector ·
 *       authAllowPattern · mainSelector · headerSelector · modalOpenSelector
 * 환경변수: A11Y_BASE_URL (baseUrl 을 덮는다) · A11Y_ID / A11Y_PW (loginPath 가 있을 때 계정)
 *
 * 위반 0 이면 exit 0, 위반이 있으면 exit 1, 준비 실패(앱·Playwright·로그인)면 exit 2.
 */
'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execSync } = require('node:child_process')

const { resolve } = require('./lib/react-repo')

const argv = process.argv.slice(2)
if (argv.includes('--help') || argv.includes('-h')) {
    console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 2).join('\n').replace(/^\/\/ /, ''))
    console.log('옵션: --modals · --route <경로>(반복) · --headed · --quiet · --max-triggers <n> · --repo <경로> · --list-routes(브라우저 없이 대상 경로만)')
    console.log('설정: workspace.json vars.react.a11y (baseUrl · routesFile · loginPath …), 계정: A11Y_ID / A11Y_PW')
    process.exit(0)
}
const { cfg, dir: CLIENT, why: NO_CLIENT } = resolve(argv)
const A11Y = cfg.a11y || {}
const BASE_URL = (process.env.A11Y_BASE_URL || A11Y.baseUrl || 'http://localhost:5173').replace(/\/$/, '')
const LOGIN_PATH = A11Y.loginPath || ''
const LOGIN_ID = process.env.A11Y_ID || ''
const LOGIN_PW = process.env.A11Y_PW || ''
const SEL = {
    main: A11Y.mainSelector || 'main',
    header: A11Y.headerSelector || 'header',
    modal: A11Y.modalOpenSelector || '.ReactModal__Content--after-open',
}
const AUTH_ALLOW = new RegExp(A11Y.authAllowPattern || '/auth/(login|refresh)$')
// 탭 순회 한도. 한 바퀴 돌아 처음 본 요소로 되돌아오면 그 전에 멈춘다.
const TAB_LIMIT = 600
const TAB_BATCH = 30
// 모달이 열렸다는 신호 — react-modal 이 열린 뒤에 붙이는 클래스 (portal 은 닫혀도 남아 있다).
const OPEN_SEL = SEL.modal
// react-modal 안에서는 브라우저의 암묵 탭 정지가 생기지 않는다 — 자체 트랩이 탭 대상을 태그·속성으로
// 열거하고(`tabbable.js` 의 `input|select|textarea|button|object|iframe` + `[tabindex]`) 꼬리에서 머리로
// 강제 순환한다(`scopeTab`). 그래서 모달 안의 결함은 반대 방향이다 — 스크롤되는데 **닿을 수 없는** 영역.

const QUIET = argv.includes('--quiet')
const HEADED = argv.includes('--headed')
const MODALS = argv.includes('--modals')
const MAX_TRIGGERS = Number(argv[argv.indexOf('--max-triggers') + 1]) || 40
const EXTRA_ROUTES = argv.reduce(
    (acc, a, i) => (a === '--route' && argv[i + 1] ? [...acc, argv[i + 1]] : acc),
    [],
)

/** playwright 를 찾는다 — 로컬 require → 전역 설치 → npx 캐시(Playwright MCP 가 받아 둔 것) 순. */
function loadPlaywright() {
    const tried = []
    try {
        return require('playwright')
    } catch {
        tried.push('require("playwright")')
    }
    try {
        return require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright'))
    } catch {
        tried.push('npm root -g')
    }
    const cache = path.join(os.homedir(), '.npm', '_npx')
    if (fs.existsSync(cache)) {
        for (const dir of fs.readdirSync(cache)) {
            const p = path.join(cache, dir, 'node_modules', 'playwright')
            if (!fs.existsSync(p)) continue
            try {
                return require(p)
            } catch {
                /* 다음 후보 */
            }
        }
        tried.push('~/.npm/_npx/*/node_modules/playwright')
    }
    console.error('playwright 를 찾지 못했습니다. 아래 중 하나로 준비하세요.')
    console.error('  1) Playwright MCP 를 한 번 쓰면 npx 캐시에 받아집니다')
    console.error('  2) npm i -g playwright && npx playwright install chromium')
    console.error(`  찾아본 곳: ${tried.join(' / ')}`)
    process.exit(2)
}

/** 라우트 설정 파일에서 파라미터 없는 경로만 뽑는다. excludeRoutes 정규식에 걸리면 뺀다. */
function staticRoutes() {
    if (!A11Y.routesFile) {
        console.error('라우트를 모릅니다. vars.react.a11y.routesFile 을 설정하거나 --route <경로> 를 주세요.')
        process.exit(2)
    }
    if (!CLIENT) {
        console.error(`프론트 repo 를 찾지 못했습니다: ${NO_CLIENT}`)
        process.exit(2)
    }
    const file = path.join(CLIENT, A11Y.routesFile)
    if (!fs.existsSync(file)) {
        console.error(`라우트 설정을 찾지 못했습니다: ${file}`)
        process.exit(2)
    }
    const exclude = A11Y.excludeRoutes ? new RegExp(A11Y.excludeRoutes) : null
    const found = [...fs.readFileSync(file, 'utf8').matchAll(/path:\s*[`'"]([^`'"]+)[`'"]/g)]
        .map((m) => m[1])
        // `/info/:tab?` 처럼 선택 파라미터는 떼면 그대로 열린다
        .map((p) => p.replace(/\/:[^/]+\?$/, ''))
        .filter((p) => p.startsWith('/') && !p.includes(':') && !(exclude && exclude.test(p)))
        .filter((p) => !LOGIN_PATH || p !== LOGIN_PATH)
    return [...new Set(found)]
}

/** 탭으로 밟히는 요소를 기록하는 관찰자를 심는다. 순회는 바깥에서 실제 Tab 키로 한다. */
const INSTALL_WALKER = () => {
    const NATIVE =
        /^(A|AREA|AUDIO|BUTTON|DETAILS|EMBED|IFRAME|INPUT|OBJECT|SELECT|SUMMARY|TEXTAREA|VIDEO)$/
    window.__a11y = { stops: 0, cycled: false }
    if (window.__a11yInstalled) return
    window.__a11yInstalled = true
    document.addEventListener(
        'focusin',
        () => {
            const el = document.activeElement
            if (!el || el === document.body || el === document.documentElement) return
            if (el.hasAttribute('data-a11y-seen')) {
                window.__a11y.cycled = true
                return
            }
            el.setAttribute('data-a11y-seen', '1')
            window.__a11y.stops += 1
            if (el.hasAttribute('tabindex') || NATIVE.test(el.tagName) || el.isContentEditable) return
            const c = getComputedStyle(el)
            const y = /^(auto|scroll|overlay)$/.test(c.overflowY) && el.scrollHeight - el.clientHeight > 1
            const x = /^(auto|scroll|overlay)$/.test(c.overflowX) && el.scrollWidth - el.clientWidth > 1
            // tabindex 없이 탭 정지가 된 스크롤 영역 = 브라우저가 암묵적으로 준 포커스
            if (y || x) el.setAttribute('data-a11y-probe', '1')
        },
        true,
    )
}

const RESET_MARKS = () => {
    document.querySelectorAll('[data-a11y-seen]').forEach((n) => n.removeAttribute('data-a11y-seen'))
    document.querySelectorAll('[data-a11y-probe]').forEach((n) => n.removeAttribute('data-a11y-probe'))
    window.__a11y = { stops: 0, cycled: false }
}

/** 표시된 요소들의 이름·역할·포커스 표시를 잰다. */
const COLLECT = () => {
    const sig = (el) => {
        const c = getComputedStyle(el)
        return [c.outlineStyle, c.outlineWidth, c.outlineColor, c.outlineOffset, c.boxShadow].join('|')
    }
    const label = (el) => {
        const direct = (el.getAttribute('aria-label') || '').trim()
        if (direct) return direct
        const via = (el.getAttribute('aria-labelledby') || '')
            .split(/\s+/)
            .filter(Boolean)
            .map((id) => document.getElementById(id))
            .filter(Boolean)
            .map((n) => (n.textContent || '').trim())
            .filter(Boolean)
            .join(' ')
        return via || (el.getAttribute('title') || '').trim()
    }
    const where = (el) => {
        const step = (n) => {
            const cls = [...n.classList].filter((c) => !/^(css|sc)-/.test(c)).slice(0, 2)
            return n.tagName.toLowerCase() + (n.id ? `#${n.id}` : '') + cls.map((c) => `.${c}`).join('')
        }
        const chain = []
        for (let n = el; n && n !== document.body && chain.length < 4; n = n.parentElement) {
            chain.unshift(step(n))
        }
        return chain.join(' > ')
    }

    const out = []
    for (const el of document.querySelectorAll('[data-a11y-probe]')) {
        const before = sig(el)
        const [sx, sy] = [el.scrollLeft, el.scrollTop]
        el.focus({ preventScroll: true })
        const after = sig(el)
        el.blur()
        el.scrollLeft = sx
        el.scrollTop = sy
        out.push({
            where: where(el),
            role: el.getAttribute('role') || '',
            name: label(el),
            // 포커스 전후로 그려지는 게 달라졌는가 (:focus-visible 이 켜져 있어야 의미가 있다)
            indicator: before !== after,
            focusRing:
                el.classList.contains('focus-ring') || el.classList.contains('focus-ring-inset'),
        })
    }
    return { stops: window.__a11y ? window.__a11y.stops : 0, found: out }
}

/**
 * 모달을 열 만한 버튼을 고른다. 같은 이름은 한 번만 — 표의 행마다 붙은 같은 버튼은 같은 컴포넌트다.
 * 화면을 떠나거나 세션을 끊거나 파일을 내려받는 것은 뺀다.
 */
const TRIGGERS = ({ includeHeader, main, header }) => {
    const SKIP = /(sign\s*out|log\s*out|download|export|excel|skip to main)/i
    const vis = (el) => {
        const r = el.getBoundingClientRect()
        const c = getComputedStyle(el)
        return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && c.display !== 'none'
    }
    const nameOf = (el) =>
        (el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || '')
            .trim()
            .replace(/\s+/g, ' ')
            .slice(0, 60)

    // 표의 행마다 붙은 같은 버튼은 같은 컴포넌트다. 이름(행 값)이 아니라 DOM 구조로 접는다 —
    // 그래야 사용자 20명의 상세 드로어가 20번이 아니라 한 번 열린다. 아이콘 버튼은 자기 aria-label 이
    // 있어 구조가 같아도 따로 남는다.
    const structKey = (el) => {
        const chain = []
        for (let n = el; n && chain.length < 5 && !n.matches(main); n = n.parentElement) {
            const cls = [...n.classList].filter((c) => !/^(css|sc)-/.test(c)).slice(0, 2)
            chain.unshift(n.tagName + cls.map((c) => `.${c}`).join(''))
        }
        // 열 위치까지 넣는다 — 표의 서로 다른 열에 놓인 액션 버튼은 다른 컴포넌트인데, 둘 다
        // aria-label 이 없으면 셀 구조가 같아서 한 키로 접혀 한쪽만 검사된다.
        // 행 번호는 넣지 않으므로 같은 열의 20개 행은 그대로 하나로 접힌다.
        const cell = el.closest('td')
        return [chain.join('>'), el.getAttribute('aria-label') || '', cell ? cell.cellIndex : ''].join('|')
    }

    const headerEl = document.querySelector(header)
    const scopes = [document.querySelector(main)]
    // 헤더는 화면마다 똑같아서 라우트마다 돌면 같은 메뉴를 경로 수만큼 연다. 첫 라우트에서만 본다.
    if (includeHeader) scopes.push(headerEl)
    const seen = new Set()
    const out = []
    for (const scope of scopes.filter(Boolean)) {
        for (const el of scope.querySelectorAll('button:not([disabled])')) {
            // 페이지 번호는 모달을 열지 않고 쪽마다 하나씩 있어 자리만 차지한다
            if (!vis(el) || el.closest('[inert]') || el.closest('.pagination')) continue
            const name = nameOf(el)
            if (!name || SKIP.test(name)) continue
            // 헤더는 메뉴를 여는 토글만 — 나머지는 화면마다 같아 경로 수만큼 반복된다
            if (scope === headerEl && !el.getAttribute('aria-haspopup')) {
                continue
            }
            const key = structKey(el)
            if (seen.has(key) || seen.has(`name:${name}`)) continue
            seen.add(key)
            seen.add(`name:${name}`)
            out.push(name)
        }
    }
    return out
}

/** 이름으로 트리거를 다시 찾아 표시한다. 리렌더로 노드가 바뀌어도 이름은 남는다. */
const MARK_BY_NAME = ({ name, main, header }) => {
    const vis = (el) => {
        const r = el.getBoundingClientRect()
        const c = getComputedStyle(el)
        return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && c.display !== 'none'
    }
    const nameOf = (el) =>
        (el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || '')
            .trim()
            .replace(/\s+/g, ' ')
            .slice(0, 60)
    document.querySelectorAll('[data-a11y-click]').forEach((n) => n.removeAttribute('data-a11y-click'))
    const scopes = [document.querySelector(main), document.querySelector(header)]
    for (const scope of scopes.filter(Boolean)) {
        for (const el of scope.querySelectorAll('button:not([disabled])')) {
            if (!vis(el) || el.closest('[inert]') || nameOf(el) !== name) continue
            el.setAttribute('data-a11y-click', '1')
            return true
        }
    }
    return false
}

/** 열린 메뉴의 항목 이름들 — 이 중 다이얼로그를 여는 것이 있다. */
const MENU_ITEMS = () => {
    const open = [...document.querySelectorAll('[role="menu"]')].filter((m) => {
        const r = m.getBoundingClientRect()
        return r.width > 0 && r.height > 0
    })
    const SKIP = /(sign\s*out|log\s*out)/i
    const out = []
    for (const menu of open) {
        for (const item of menu.querySelectorAll('[role="menuitem"]')) {
            const n = (item.getAttribute('aria-label') || item.innerText || '').trim().replace(/\s+/g, ' ')
            if (n && !SKIP.test(n)) out.push(n)
        }
    }
    return out
}

const MARK_MENU_ITEM = (name) => {
    document.querySelectorAll('[data-a11y-click]').forEach((n) => n.removeAttribute('data-a11y-click'))
    for (const item of document.querySelectorAll('[role="menuitem"]')) {
        const n = (item.getAttribute('aria-label') || item.innerText || '').trim().replace(/\s+/g, ' ')
        if (n !== name) continue
        item.setAttribute('data-a11y-click', '1')
        return true
    }
    return false
}

/**
 * 열린 모달 안에서 스크롤되는데 Tab 이 닿지 않는 영역. 안에 포커스 가능한 자식이 하나도 없으면
 * 키보드로는 그 안을 스크롤할 방법이 없어 화면 밖 내용에 닿지 못한다(WCAG 2.1.1).
 * react-modal 은 `[tabindex]` 를 탭 대상으로 인정하므로 `tabIndex={0}` 이 해결책이다.
 */
const COLLECT_UNREACHABLE = (modalSel) => {
    const FOCUSABLE = 'a[href], button, input, select, textarea, object, iframe, [tabindex], [contenteditable]'
    const where = (el) => {
        const step = (n) => {
            const cls = [...n.classList].filter((c) => !/^(css|sc)-/.test(c)).slice(0, 2)
            return n.tagName.toLowerCase() + (n.id ? `#${n.id}` : '') + cls.map((c) => `.${c}`).join('')
        }
        const chain = []
        for (let n = el; n && n !== document.body && chain.length < 4; n = n.parentElement) {
            chain.unshift(step(n))
        }
        return chain.join(' > ')
    }
    const out = []
    for (const modal of document.querySelectorAll(modalSel)) {
        for (const el of modal.querySelectorAll('*')) {
            if (el.hasAttribute('tabindex') || el.hasAttribute('data-a11y-seen')) continue
            const c = getComputedStyle(el)
            if (c.display === 'none' || c.visibility === 'hidden') continue
            const y = /^(auto|scroll|overlay)$/.test(c.overflowY) && el.scrollHeight - el.clientHeight > 1
            const x = /^(auto|scroll|overlay)$/.test(c.overflowX) && el.scrollWidth - el.clientWidth > 1
            if (!y && !x) continue
            // 안에 포커스 가능한 것이 있으면 그것을 타고 들어가며 스크롤이 따라간다
            if (el.querySelector(FOCUSABLE)) continue
            out.push({ where: where(el), kind: 'unreachable' })
        }
    }
    return out
}

async function walk(page) {
    await page.evaluate(INSTALL_WALKER)
    for (let pressed = 0; pressed < TAB_LIMIT; pressed += TAB_BATCH) {
        for (let i = 0; i < TAB_BATCH; i += 1) await page.keyboard.press('Tab')
        if (await page.evaluate(() => window.__a11y.cycled)) break
    }
    return page.evaluate(COLLECT)
}

/** 열려 있는 모달을 닫는다. 안 닫히면 라우트를 다시 열어 초기 상태로 되돌린다. */
async function closeModal(page, route) {
    for (let i = 0; i < 2; i += 1) {
        await page.keyboard.press('Escape')
        await page.waitForTimeout(350)
        if (!(await page.locator(OPEN_SEL).count())) return true
    }
    await gotoRoute(page, route)
    return false
}

async function gotoRoute(page, route) {
    await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
    await page.waitForTimeout(700)
}

/** 한 트리거를 눌러 모달이 열리면 그 안을 순회한다. 메뉴가 열리면 항목까지 한 단계 더 들어간다. */
async function openAndWalk(page, route, label, markFn, arg, sink, tally) {
    if (!(await page.evaluate(markFn, arg))) return
    await page.click('[data-a11y-click="1"]', { timeout: 3000 }).catch(() => {})
    await page.waitForTimeout(500)

    if (page.url().replace(BASE_URL, '') !== route) {
        await gotoRoute(page, route) // 화면을 떠난 트리거 — 되돌린다
        return
    }
    if (await page.locator(OPEN_SEL).count()) {
        await page.evaluate(RESET_MARKS)
        const { found } = await walk(page)
        tally.modals += 1
        tally.names.push(label)
        for (const f of found) sink.push({ where: `[${label}] ${f.where}`, ...f })
        for (const u of await page.evaluate(COLLECT_UNREACHABLE, OPEN_SEL)) {
            tally.unreachable += 1
            sink.push({ where: `[${label}] ${u.where}`, kind: 'unreachable' })
        }
        await closeModal(page, route)
        return
    }
    // 모달이 아니라 메뉴가 열렸으면 항목을 한 번씩 눌러 본다
    const items = await page.evaluate(MENU_ITEMS)
    for (const item of items) {
        if (!(await page.evaluate(MARK_MENU_ITEM, item))) continue
        await page.click('[data-a11y-click="1"]', { timeout: 3000 }).catch(() => {})
        await page.waitForTimeout(600)
        if (page.url().replace(BASE_URL, '') !== route) {
            await gotoRoute(page, route)
        } else if (await page.locator(OPEN_SEL).count()) {
            await page.evaluate(RESET_MARKS)
            const { found } = await walk(page)
            tally.modals += 1
            tally.names.push(`${label} > ${item}`)
            for (const f of found) sink.push({ where: `[${label} > ${item}] ${f.where}`, ...f })
            for (const u of await page.evaluate(COLLECT_UNREACHABLE, OPEN_SEL)) {
                tally.unreachable += 1
                sink.push({ where: `[${label} > ${item}] ${u.where}`, kind: 'unreachable' })
            }
            await closeModal(page, route)
        }
        // 다음 항목을 위해 메뉴를 다시 연다
        if (!(await page.evaluate(markFn, arg))) break
        await page.click('[data-a11y-click="1"]', { timeout: 3000 }).catch(() => {})
        await page.waitForTimeout(400)
    }
    await page.keyboard.press('Escape').catch(() => {})
}

async function main() {
    const routes = EXTRA_ROUTES.length ? EXTRA_ROUTES : staticRoutes()
    if (argv.includes('--list-routes')) {
        console.log(routes.join('\n'))
        return 0
    }
    const { chromium } = loadPlaywright()
    if (!QUIET) {
        console.log(
            `대상 라우트 ${routes.length}개${MODALS ? ' (드로어·다이얼로그까지)' : ''}: ${routes.join(' ')}`,
        )
    }

    const browser = await chromium.launch({ headless: !HEADED })
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

    try {
        await page.goto(`${BASE_URL}${LOGIN_PATH || routes[0] || '/'}`, { waitUntil: 'domcontentloaded', timeout: 15_000 })
    } catch (e) {
        console.error(`앱에 접속하지 못했습니다. ${BASE_URL} 가 떠 있는지 확인하세요 (${e.message.split('\n')[0]})`)
        await browser.close()
        process.exit(2)
    }
    if (LOGIN_PATH) {
        if (!LOGIN_ID || !LOGIN_PW) {
            console.error('loginPath 가 설정돼 있습니다. A11Y_ID / A11Y_PW 환경변수로 계정을 주세요.')
            await browser.close()
            process.exit(2)
        }
        await page.fill(A11Y.loginIdSelector || 'input[name="username"]', LOGIN_ID)
        await page.fill(A11Y.loginPasswordSelector || 'input[type="password"]', LOGIN_PW)
        await page.click(A11Y.loginSubmitSelector || 'button[type="submit"]')
        await page.waitForURL((u) => !u.pathname.startsWith(LOGIN_PATH), { timeout: 30_000 }).catch(() => {})
        if (new URL(page.url()).pathname.startsWith(LOGIN_PATH)) {
            console.error(`로그인 실패: ${LOGIN_ID} 로 들어가지 못했습니다. A11Y_ID / A11Y_PW · 셀렉터를 확인하세요.`)
            await browser.close()
            process.exit(2)
        }
    }

    if (MODALS) {
        // 클릭이 데이터를 바꾸지 못하게 쓰기를 막는다. 로그인·토큰갱신은 열어 둬야 세션이 유지된다.
        await page.route('**/*', (r) => {
            const method = r.request().method()
            if (method === 'GET') return r.continue()
            if (AUTH_ALLOW.test(r.request().url())) return r.continue()
            return r.abort()
        })
    }

    const violations = []
    let stops = 0
    const tally = { modals: 0, unreachable: 0, names: [] }
    let opened = 0
    try {
        for (const route of routes) {
            await gotoRoute(page, route)
            const { stops: n, found } = await walk(page)
            stops += n
            const rows = [...found]

            if (MODALS) {
                const triggers = (
                    await page.evaluate(TRIGGERS, { includeHeader: route === routes[0], main: SEL.main, header: SEL.header })
                ).slice(
                    0,
                    MAX_TRIGGERS,
                )
                opened += triggers.length
                for (const name of triggers) {
                    await openAndWalk(page, route, name, MARK_BY_NAME, { name, main: SEL.main, header: SEL.header }, rows, tally)
                }
            }

            for (const f of rows) {
                if (f.kind === 'unreachable') {
                    violations.push({ route, ...f, missing: ['키보드로 닿지 않는 스크롤 영역'] })
                    continue
                }
                const missing = []
                if (!f.name) missing.push('이름 없음')
                if (!f.role) missing.push('역할 없음')
                // 브라우저 기본 링은 앱의 다른 포커스 표시와 모양이 달라 그것대로 결함이다
                if (!f.focusRing) {
                    missing.push(f.indicator ? '포커스 표시가 브라우저 기본' : '포커스 표시 없음')
                }
                if (missing.length) violations.push({ route, ...f, missing })
            }
            if (!QUIET) process.stderr.write('.')
        }
    } finally {
        await browser.close()
        if (!QUIET) process.stderr.write('\n')
    }

    const scale =
        `라우트 ${routes.length}개 · 탭 정지 ${stops}개` +
        (MODALS ? ` · 트리거 ${opened}개 → 열린 모달 ${tally.modals}개` : '')
    if (MODALS && !QUIET) {
        console.log(`열어 본 모달 ${tally.modals}개: ${tally.names.join(' / ') || '(없음)'}`)
    }
    if (!violations.length) {
        console.log(`암묵 포커스 검사 통과: ${scale} 확인, 위반 0`)
        return 0
    }
    console.log(`암묵 포커스 위반 ${violations.length}건 (${scale})`)
    if (QUIET) return 1
    console.log(
        '\n브라우저가 tabindex 없이 탭 정지로 만든 스크롤 영역이다. 없애지 말고 이름·역할·포커스 표시를 준다.',
    )
    console.log('  <div role="group" aria-label="…" className="focus-ring …">')
    console.log(
        '모달 안 「키보드로 닿지 않는 스크롤 영역」은 그 반대다. 포커스 트랩이 태그·속성으로 탭 대상을 고르므로',
    )
    console.log('  tabIndex={0} 까지 붙여야 닿는다.\n')
    for (const v of violations) {
        console.log(`  ${v.route}`)
        console.log(`    ${v.where}`)
        console.log(`    ${v.missing.join(' · ')}${v.name ? `  (이름 "${v.name}")` : ''}`)
    }
    return 1
}

main().then(
    (code) => process.exit(code),
    (err) => {
        console.error(err && err.stack ? err.stack : err)
        process.exit(2)
    },
)
