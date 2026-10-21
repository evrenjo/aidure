/* 생성물: aidure docs build. 원본은 킷의 packs/core/assets/docs-site/src/ (+ 공통 부품 packs/core/assets/docs-site/shared/) (손으로 고치지 않는다) */
/* ── 10-sidehead.js ── */
/* 사이드바 머리 줄 (문서 사이트 · ERD 뷰어 공통 부품): 왼쪽 = 제목(문서는 「홈」 링크, ERD 는 「테이블 n」), 오른쪽 = 모두 접기 ↔ 모두 펴기 토글 하나.
   펼친 묶음이 하나라도 있으면 「모두 접기」, 모두 접혀 있으면 「모두 펴기」 (아이콘 · 툴팁이 다음 동작). 생성기가 site.js · erd.js 앞에 같이 넣는다.
   아이콘: Lucide house · chevrons-down-up · chevrons-up-down (ISC) */
(function () {
  "use strict";
  var h = window.preact.h, html = window.htm.bind(h);
  var svg = function (d) { return html`<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" dangerouslySetInnerHTML=${{ __html: d }}></svg>`; };
  var I = {
    home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    fold: '<path d="m7 20 5-5 5 5"/><path d="m7 4 5 5 5-5"/>',
    unfold: '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>'
  };
  /** props: { label, href?, home?, current?, anyOpen, onToggle(open) } */
  window.SideHead = function SideHead(props) {
    var title = props.href
      ? html`<a class=${"side-head-title" + (props.current ? " on" : "")} href=${props.href} aria-current=${props.current ? "page" : undefined}>${props.home ? svg(I.home) : null}<span>${props.label}</span></a>`
      : html`<span class="side-head-title">${props.label}</span>`;
    var tip = props.anyOpen ? "모두 접기" : "모두 펴기";
    return html`<div class="side-head">${title}<button type="button" class="side-head-btn" title=${tip} aria-label=${tip} onClick=${function () { props.onToggle(!props.anyOpen); }}>${svg(props.anyOpen ? I.fold : I.unfold)}</button></div>`;
  };
})();
/* ── 00-core.js ── */
/* 문서 사이트 앱 (aidure docs build · aidure board · 킷 가이드 공통). 생성기가 src/*.js 를 이름 순으로 이어 assets/site.js 하나로 만든다.
   화면은 Preact + htm (assets/vendor.js, 빌드 없음). 쪽마다 본문 HTML(.ds-body)과 쪽 정보(script#ds-page)가 있고,
   앱이 그 둘로 화면 전체를 그린다. 다른 쪽으로 갈 때는 그 쪽 파일을 읽어 둘만 꺼내 바꾼다 (새로고침 없음, file:// 에서는 새로 연다).
   여기: 이름공간 DS · 공통 도구 (주소 · 저장 · 이스케이프 · 알림) */
(function () {
  "use strict";
  var DS = window.DS = window.DS || {};
  var P = window.preact;
  DS.h = P.h;
  DS.render = P.render;
  DS.html = window.htm.bind(P.h);
  DS.hooks = window.preactHooks;

  /* 사이트 맨 위 주소: 이 스크립트(assets/site.js)의 한 단계 위. 쪽마다 깊이가 달라도, 하위 경로(/그룹/repo/)에 올려도 같다 */
  var me = document.currentScript && document.currentScript.src;
  DS.root = me ? new URL("../", me).href : new URL(document.body.getAttribute("data-root") || "./", location.href).href;
  DS.url = function (p) { return new URL(p, DS.root).href; };
  /* 주소 → 사이트 안 쪽 경로 (index.html 생략 · # · ? 뺌). 사이트 밖이면 null */
  DS.pageOf = function (href) {
    var u;
    try { u = new URL(href, location.href); } catch (e) { return null; }
    var base = new URL(DS.root);
    if (u.origin !== base.origin || u.pathname.indexOf(base.pathname) !== 0) return null;
    var p = u.pathname.slice(base.pathname.length);
    try { p = decodeURIComponent(p); } catch (e) { /* 그대로 */ }
    if (!p || /\/$/.test(p)) p += "index.html";
    return p;
  };
  DS.file = location.protocol === "file:";
  try { DS.embedded = window.self !== window.top; } catch (e) { DS.embedded = true; }   /* 화면설계서 · ERD 근거 패널(iframe) 안 = 본문만 */
  if (DS.embedded) document.documentElement.classList.add("embedded");

  DS.esc = function (s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); };
  /* 이 기기 저장: 사생활 창 · 막힌 저장소에서도 화면은 그대로 */
  DS.load = function (k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  DS.keep = function (k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 저장 못 함 */ } };

  /* 알림: page(새 쪽을 그린 뒤 { el, meta }) · theme. docs-site.extra.js 도 DS.on("page", fn) 으로 쪽마다 돈다 */
  var subs = {};
  DS.on = function (name, fn) { (subs[name] = subs[name] || []).push(fn); };
  DS.emit = function (name, arg) { (subs[name] || []).forEach(function (fn) { try { fn(arg); } catch (e) { if (window.console) console.error(e); } }); };

  /* 스크립트 하나 읽기 (file:// 에서도 된다): 검색 색인 · mermaid */
  var scripts = {};
  DS.script = function (p, check) {
    if (check && check()) return Promise.resolve();
    if (!scripts[p]) scripts[p] = new Promise(function (ok, no) {
      var s = document.createElement("script");
      var v = ((window.DS_NAV || {}).v || {})[p];
      s.src = DS.url(p) + (v ? "?v=" + v : "");   /* 다시 만든 파일은 주소가 바뀐다 (옛 캐시를 쓰지 않게) */
      s.onload = function () { ok(); };
      s.onerror = function () { delete scripts[p]; no(new Error(p + " 가 없습니다 (aidure docs build 로 다시 만든다)")); };
      document.head.appendChild(s);
    });
    return scripts[p];
  };

  DS.ICON = {
    ink: '<path d="M13 21h8"/><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>',
    print: '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
    theme: '<circle cx="12" cy="12" r="10"/><path d="M12 18a6 6 0 0 0 0-12v12z"/>'
  };
  /* 선 아이콘 (Lucide, ISC). paths = SVG 경로 글자 */
  DS.Icon = function (props) {
    return DS.h("svg", { viewBox: "0 0 24 24", width: 18, height: 18, fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", dangerouslySetInnerHTML: { __html: props.paths } });
  };
})();
/* ── 10-router.js ── */
/* 쪽 이동: 사이트 안 링크를 누르면 그 쪽 파일을 읽어 쪽 정보 · 본문만 꺼내 바꾼다 (주소는 history 로).
   못 옮기는 곳(화면설계서 · ERD 뷰어 · 사이트 밖 · file://)이나 읽기에 실패하면 브라우저가 그냥 연다.
   뒤로 · 앞으로 가기는 그 쪽의 스크롤 위치로 돌아간다 */
(function () {
  "use strict";
  var DS = window.DS;
  var NAV = window.DS_NAV || { groups: [], pages: [] };
  var routable = {};
  (NAV.pages || []).forEach(function (p) { routable[p] = true; });
  var cache = {};

  /* 문서(쪽 파일) → { meta, body } */
  DS.readDoc = function (doc) {
    var m = doc.getElementById("ds-page"), b = doc.querySelector(".ds-body");
    if (!m || !b) return null;
    var meta;
    try { meta = JSON.parse(m.textContent); } catch (e) { return null; }
    return { meta: meta, body: b.innerHTML };
  };
  /* 쪽 경로 → Promise<{ meta, body }> (한 번 읽은 쪽은 기억) */
  DS.fetchPage = function (page) {
    if (!cache[page]) cache[page] = fetch(DS.url(page), { credentials: "same-origin", cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error(r.status + " " + page);
      return r.text();
    }).then(function (t) {
      var d = DS.readDoc(new DOMParser().parseFromString(t, "text/html"));
      if (!d) throw new Error("쪽 정보가 없습니다: " + page);
      return d;
    }).catch(function (e) { delete cache[page]; throw e; });
    return cache[page];
  };
  DS.canRoute = function (href) {
    if (DS.file || !window.fetch || !window.history.pushState) return false;
    var p = DS.pageOf(href);
    return !!(p && routable[p]);
  };

  var listeners = [];
  /* 앱이 듣는다: fn({ meta, body }, { hash, y }) */
  DS.onRoute = function (fn) { listeners.push(fn); };
  var seq = 0;
  function show(d, opt) { listeners.forEach(function (fn) { fn(d, opt); }); }
  function remember() { try { history.replaceState({ ds: 1, y: window.scrollY }, ""); } catch (e) { /* 막힘 */ } }

  /* 주소로 간다. push = 새 기록 (뒤로 가기용) */
  DS.go = function (href, push) {
    if (push === undefined) push = true;
    var u = new URL(href, location.href);
    if (!DS.canRoute(u.href)) { location.assign(u.href); return; }
    var page = DS.pageOf(u.href), my = ++seq;
    document.documentElement.classList.add("ds-loading");
    DS.fetchPage(page).then(function (d) {
      if (my !== seq) return;
      document.documentElement.classList.remove("ds-loading");
      if (push) { remember(); history.pushState({ ds: 1, y: 0 }, "", u.href); }
      show(d, { hash: u.hash, y: push ? 0 : (history.state && history.state.y) || 0 });
    }, function () {
      if (my === seq) location.assign(u.href);
    });
  };
  /* 미리 읽기: 링크에 올리면 (누를 때 기다리지 않게) */
  DS.prefetch = function (href) { if (DS.canRoute(href)) DS.fetchPage(DS.pageOf(href)).catch(function () {}); };

  /* 링크 누름: 새 창 · 수정키 · 받기 · 같은 쪽 #이동은 브라우저에 맡긴다 */
  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
    var u = new URL(a.href, location.href);
    if (u.origin === location.origin && u.pathname === location.pathname && u.search === location.search) {
      if (!u.hash && DS.canRoute(u.href)) { e.preventDefault(); window.scrollTo(0, 0); }   /* 지금 쪽 다시 누름 = 맨 위로 (다시 읽지 않는다) */
      return;   /* #이동은 브라우저가 */
    }
    if (!DS.canRoute(u.href)) return;
    e.preventDefault();
    DS.go(u.href);
  });
  var hoverT = 0;
  document.addEventListener("mouseover", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    clearTimeout(hoverT);
    hoverT = setTimeout(function () { DS.prefetch(a.href); }, 80);
  });
  window.addEventListener("popstate", function () {
    if (DS.canRoute(location.href)) DS.go(location.href, false);
  });
  /* 떠날 때 · 스크롤을 멈출 때 지금 위치를 기록 (뒤로 가기로 돌아오면 그 자리) */
  var st = 0;
  window.addEventListener("scroll", function () { clearTimeout(st); st = setTimeout(remember, 150); }, { passive: true });
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
})();
/* ── 20-nav.js ── */
/* 왼쪽 메뉴: assets/nav.js(window.DS_NAV.groups) 를 그린다. 지금 쪽 표시 · 묶음/폴더 접기(사이트별로 기억, 지금 쪽이 든 곳은 편다) · 모두 펴기/접기.
   좁은 화면에서는 ☰ 로 여는 서랍 (검색창이 서랍 맨 위로 온다) */
(function () {
  "use strict";
  var DS = window.DS, html = DS.html, H = DS.hooks;
  var NAV = window.DS_NAV || { groups: [] };
  var KEY = "aidure-docs-nav:" + (NAV.key || "");

  /* 이 쪽이 든 묶음 · 폴더 키들 */
  function pathTo(page) {
    var out = [];
    function walk(items, keys) {
      for (var i = 0; i < items.length; i++) {
        var x = items[i];
        if (x.items) { if (walk(x.items, keys.concat(x.k))) return true; }
        else if (x.p === page) { out = keys; return true; }
      }
      return false;
    }
    (NAV.groups || []).some(function (g) { return walk(g.items, [g.k]); });
    return out;
  }
  function allKeys() {
    var out = [];
    function walk(items) { items.forEach(function (x) { if (x.items) { out.push(x.k); walk(x.items); } }); }
    (NAV.groups || []).forEach(function (g) { out.push(g.k); walk(g.items); });
    return out;
  }

  /* 접기 표시: 선 화살표(Lucide chevron-right, ISC). 펼치면 아래로 돈다 (CSS) */
  var Chev = function () { return html`<svg class="chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>`; };

  function Items(props) {
    return props.items.map(function (x) {
      if (x.items) return html`<details class="nav-dir" key=${x.k} open=${props.isOpen(x.k, false)} onToggle=${props.toggle(x.k)}><summary><${Chev} />${x.dir}</summary><${Items} items=${x.items} isOpen=${props.isOpen} toggle=${props.toggle} cur=${props.cur} /></details>`;
      return html`<a key=${x.p} class=${"nav-link" + (x.p === props.cur ? " on" : "")} href=${DS.url(x.p)} aria-current=${x.p === props.cur ? "page" : undefined}>${x.t}</a>`;
    });
  }

  DS.Nav = function Nav(props) {
    var cur = props.page;
    var s = H.useState(function () { return DS.load(KEY, {}) || {}; }), st = s[0], setSt = s[1];
    var ref = H.useRef(null);
    /* 지금 쪽이 든 묶음 · 폴더는 편다 (쪽을 옮길 때마다) */
    H.useEffect(function () {
      var need = pathTo(cur).filter(function (k) { return st[k] === false; });
      if (need.length) { var n = Object.assign({}, st); need.forEach(function (k) { n[k] = true; }); setSt(n); DS.keep(KEY, n); }
      var on = ref.current && ref.current.querySelector(".nav-link.on");
      if (on && on.scrollIntoView) on.scrollIntoView({ block: "nearest" });
    }, [cur]);
    var groupOpen = {};
    (NAV.groups || []).forEach(function (g) { groupOpen[g.k] = g.open; });
    function isOpen(k, dflt) { return Object.prototype.hasOwnProperty.call(st, k) ? !!st[k] : (k in groupOpen ? groupOpen[k] : dflt); }
    function toggle(k) {
      return function (e) {
        var o = e.currentTarget.open;
        if (isOpen(k, false) === o) return;
        var n = Object.assign({}, st); n[k] = o; setSt(n); DS.keep(KEY, n);
      };
    }
    function all(on) {
      var n = {}, keep = pathTo(cur);
      allKeys().forEach(function (k) { n[k] = on || keep.indexOf(k) >= 0; });
      setSt(n); DS.keep(KEY, n);
    }
    var acts = function (g) {
      return g.acts.map(function (a) {
        return html`<a class="nav-act" key=${a.label} href=${DS.url(a.p) + (a.h ? "#" + a.h : "")} title=${a.label} aria-label=${a.label} onClick=${function (e) { e.stopPropagation(); }}>▶</a>`;
      });
    };
    return html`<nav class="side" id="side-nav" ref=${ref} onClick=${function (e) { if (e.target.closest && e.target.closest("a")) props.onPick(); }}>
      ${props.search}
      <${window.SideHead} label="홈" home=${true} href=${DS.url("index.html")} current=${cur === "index.html"}
        anyOpen=${allKeys().some(function (k) { return pathTo(cur).indexOf(k) < 0 && isOpen(k, k in groupOpen ? groupOpen[k] : false); })} onToggle=${all} />
      ${(NAV.groups || []).map(function (g) {
        return html`<details class="nav-group" key=${g.k} open=${isOpen(g.k, true)} onToggle=${toggle(g.k)}><summary class="nav-title"><${Chev} /><span class="ico">${g.icon}</span>${g.group}${acts(g)}</summary><${Items} items=${g.items} isOpen=${isOpen} toggle=${toggle} cur=${cur} /></details>`;
      })}
    </nav>`;
  };

  /* 좁은 화면인가 (761px 미만) */
  DS.useNarrow = function () {
    var mq = window.matchMedia && window.matchMedia("(max-width: 760px)");
    var s = H.useState(!!(mq && mq.matches));
    H.useEffect(function () {
      if (!mq) return;
      var f = function (e) { s[1](e.matches); };
      if (mq.addEventListener) mq.addEventListener("change", f); else mq.addListener(f);
      return function () { if (mq.removeEventListener) mq.removeEventListener("change", f); else mq.removeListener(f); };
    }, []);
    return s[0];
  };
})();
/* ── 30-search.js ── */
/* 검색(⌘K): 정의 ID(앞부분) · 문서 제목 · 소제목(글자 포함) · 본문(MiniSearch, 낱말 앞부분 · 오타 조금).
   제목 색인은 assets/search.js(DS_SEARCH), 본문 색인은 assets/search-text.js(DS_TEXT) 를 처음 검색할 때 읽는다 */
(function () {
  "use strict";
  var DS = window.DS, html = DS.html, H = DS.hooks;
  var MAX = 30;
  var mini = null, miniLoad = null;

  function textIndex() {
    if (mini) return Promise.resolve(mini);
    if (!miniLoad) miniLoad = DS.script("assets/search-text.js", function () { return !!window.DS_TEXT; }).then(function () {
      var docs = (window.DS_TEXT || []).map(function (x, i) { return { id: i, u: x.u, h: x.h, t: x.t, x: x.x }; });
      mini = new window.MiniSearch({ fields: ["t", "x"], storeFields: ["u", "h", "t", "x"] });
      mini.addAll(docs);
      return mini;
    });
    return miniLoad;
  }

  /* 본문 조각: 처음 맞은 낱말 앞뒤 */
  function snippet(text, terms) {
    var low = text.toLowerCase(), at = -1, len = 0;
    terms.forEach(function (t) { var i = low.indexOf(t); if (i >= 0 && (at < 0 || i < at)) { at = i; len = t.length; } });
    if (at < 0) return [text.slice(0, 90)];
    var a = Math.max(0, at - 36), b = Math.min(text.length, at + len + 54);
    return [(a ? "…" : "") + text.slice(a, at), html`<mark>${text.slice(at, at + len)}</mark>`, text.slice(at + len, b) + (b < text.length ? "…" : "")];
  }

  function find(v) {
    var S = window.DS_SEARCH || { pages: [], ids: [] }, out = [], seen = {};
    var add = function (h) { if (out.length >= MAX || seen[h.href]) return; seen[h.href] = 1; out.push(h); };
    var low = v.toLowerCase();
    S.ids.forEach(function (x) { if (x[0].toLowerCase().indexOf(low) === 0) add({ href: DS.url(x[1]), t: x[0], s: x[2], k: "ID" }); });
    var titleOf = {};
    S.pages.forEach(function (p) {
      titleOf[p.u] = p;
      if ((p.t + " " + p.g).toLowerCase().indexOf(low) >= 0) add({ href: DS.url(p.u), t: p.t, s: p.g, k: "문서" });
    });
    S.pages.forEach(function (p) {
      p.h.forEach(function (h) { if (h[1].toLowerCase().indexOf(low) >= 0) add({ href: DS.url(p.u) + "#" + h[0], t: h[1], s: p.g + " › " + p.t, k: "절" }); });
    });
    if (mini && out.length < MAX) {
      var terms = low.split(/\s+/).filter(Boolean);
      mini.search(v, { prefix: true, fuzzy: function (t) { return t.length > 4 ? 0.2 : false; }, boost: { t: 2 }, combineWith: "AND" }).slice(0, MAX).forEach(function (r) {
        var p = titleOf[r.u] || { t: r.u, g: "" };
        add({ href: DS.url(r.u) + (r.h ? "#" + r.h : ""), t: r.h ? r.t : p.t, s: (p.g ? p.g + " › " : "") + p.t, k: "본문", x: snippet(r.x, terms.concat(Object.keys(r.match || {}))) });
      });
    }
    return out;
  }

  DS.Search = function Search() {
    var q = H.useState(""), v = q[0], setV = q[1];
    var s = H.useState(0), sel = s[0], setSel = s[1];
    var o = H.useState(false), open = o[0], setOpen = o[1];
    var r = H.useState(0), bump = r[1];   /* 본문 색인을 다 읽으면 다시 찾는다 */
    var input = H.useRef(null), box = H.useRef(null);
    var hits = H.useMemo(function () { return v.trim() ? find(v.trim()) : []; }, [v, r[0]]);
    H.useEffect(function () {
      function key(e) { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); if (input.current) input.current.focus(); } }
      function out(e) { if (box.current && !box.current.contains(e.target)) setOpen(false); }
      document.addEventListener("keydown", key);
      document.addEventListener("click", out);
      return function () { document.removeEventListener("keydown", key); document.removeEventListener("click", out); };
    }, []);
    function warm() { textIndex().then(function () { bump(function (n) { return n + 1; }); }, function () {}); }
    function pick(h) { setV(""); setOpen(false); if (input.current) input.current.blur(); DS.go(h.href); }
    function onKey(e) {
      if ((e.key === "ArrowDown" || e.key === "ArrowUp") && hits.length) { e.preventDefault(); setSel((sel + (e.key === "ArrowDown" ? 1 : -1) + hits.length) % hits.length); }
      else if (e.key === "Enter" && hits[sel]) { e.preventDefault(); pick(hits[sel]); }
      else if (e.key === "Escape") { setV(""); setOpen(false); e.currentTarget.blur(); }
    }
    var show = open && v.trim();
    return html`<div class="search" ref=${box}>
      <input id="q" ref=${input} value=${v} placeholder="검색 (제목 · 본문 · ID)" autocomplete="off" aria-label="검색"
        onFocus=${function () { warm(); setOpen(true); }} onInput=${function (e) { setV(e.currentTarget.value); setSel(0); setOpen(true); }} onKeyDown=${onKey} />
      <kbd>⌘K</kbd>
      <div class="results" id="results" style=${{ display: show ? "block" : "none" }}>
        ${hits.length ? hits.map(function (h, i) {
          return html`<a key=${h.href} href=${h.href} class=${i === sel ? "on" : ""} onClick=${function (e) { if (e.button || e.metaKey || e.ctrlKey) return; e.preventDefault(); pick(h); }}><span class="kind">${h.k}</span>${h.t}<small>${h.s}</small>${h.x ? html`<span class="snip">${h.x}</span>` : null}</a>`;
        }) : html`<a>${mini || !miniLoad ? "결과 없음" : "본문 색인을 읽는 중…"}</a>`}
      </div>
    </div>`;
  };
})();
/* ── 40-body.js ── */
/* 본문 동작: 코드 복사 · #ID 로 열 때 펼치고 강조 · mermaid 그림(테마를 바꾸면 다시) · 그림 확대 · 새 창 · 오른쪽 목차 따라가기 */
(function () {
  "use strict";
  var DS = window.DS, html = DS.html, H = DS.hooks;
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* 코드 복사 */
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("button.copy");
    if (!b || !navigator.clipboard) return;
    navigator.clipboard.writeText(b.nextElementSibling.textContent).then(function () { b.textContent = "복사됨"; setTimeout(function () { b.textContent = "복사"; }, 1200); });
  });

  /* #ID: 접힌 곳(결정 카드 · 더 보기 · 메뉴 아닌 details)을 펼치고 그 위치로 가서 강조 */
  DS.reveal = function (hash, scroll) {
    if (!hash || hash === "#") return false;
    var id;
    try { id = decodeURIComponent(hash.slice(1)); } catch (e) { return false; }
    var t = document.getElementById(id);
    if (!t) return false;
    for (var p = t; p; p = p.parentElement) if (p.tagName === "DETAILS") p.open = true;
    var row = (t.closest && t.closest("tr")) || t;
    $$(".ds-hit").forEach(function (x) { x.classList.remove("ds-hit"); });
    if (!/^H[1-6]$/.test(row.tagName)) row.classList.add("ds-hit");
    if (scroll) row.scrollIntoView({ block: "start" });
    return true;
  };
  window.addEventListener("hashchange", function () { DS.reveal(location.hash, true); });

  /* mermaid: 사이트에 넣은 파일(assets/mermaid/mermaid.min.js, 버전 고정)을 그림이 있는 쪽에서만 읽는다. 문법 오류면 그 자리에 오류 문구와 원문 */
  var mmSeq = 0;
  DS.drawDiagrams = function (root) {
    var list = $$("pre.mermaid", root);
    if (!list.length) return Promise.resolve();
    list.forEach(function (n) { if (n.dataset.src == null) n.dataset.src = n.textContent; });
    return DS.script("assets/mermaid/mermaid.min.js", function () { return !!window.mermaid; }).then(function () {
      var m = window.mermaid, dark = document.documentElement.dataset.theme === "dark";
      m.initialize({ startOnLoad: false, theme: dark ? "dark" : "default", securityLevel: "strict", suppressErrorRendering: true, flowchart: { htmlLabels: true } });
      var chain = Promise.resolve();
      list.forEach(function (n) {
        chain = chain.then(function () {
          if (!n.isConnected) return;
          var id = "mm-" + (++mmSeq);
          return m.render(id, n.dataset.src).then(function (r) {
            n.innerHTML = r.svg; n.classList.remove("mm-bad"); n.closest(".diagram").classList.remove("bad");
          }, function (e) {
            var stray = document.getElementById("d" + id); if (stray) stray.remove();
            n.classList.add("mm-bad"); n.closest(".diagram").classList.add("bad");
            n.innerHTML = '<div class="mm-err">그림을 그리지 못했습니다: ' + DS.esc(String((e && e.message) || e).split("\n").slice(0, 3).join(" ")) + "</div>" + DS.esc(n.dataset.src);
          });
        });
      });
      return chain;
    }, function (e) {
      list.forEach(function (n) { n.closest(".diagram").classList.add("bad"); n.innerHTML = '<div class="mm-err">' + DS.esc(e.message) + "</div>" + DS.esc(n.dataset.src); });
    });
  };

  /* 그림 확대: 화면 위에 크게 (더하기 · 빼기 · 맞춤 · Ctrl/⌘ 휠 · Esc 닫기) */
  function svgSize(svg) { var v = svg.viewBox && svg.viewBox.baseVal; return v && v.width ? { w: v.width, h: v.height } : { w: svg.getBoundingClientRect().width, h: svg.getBoundingClientRect().height }; }
  function Zoom(props) {
    var size = svgSize(props.svg), stage = H.useRef(null), k = H.useState(1), setK = function (v) { k[1](Math.max(0.1, Math.min(8, v))); };
    var copy = H.useMemo(function () { var c = props.svg.cloneNode(true); c.removeAttribute("style"); c.removeAttribute("width"); c.removeAttribute("height"); return c; }, [props.svg]);
    function fit() { var s = stage.current; if (s) setK(Math.min((s.clientWidth - 32) / size.w, (s.clientHeight - 32) / size.h, 2)); }
    H.useEffect(function () {
      stage.current.appendChild(copy); fit();
      function key(e) { if (e.key === "Escape") props.onClose(); }
      function wheel(e) { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); k[1](function (v) { return Math.max(0.1, Math.min(8, v * (e.deltaY < 0 ? 1.1 : 1 / 1.1))); }); }
      document.addEventListener("keydown", key);
      stage.current.addEventListener("wheel", wheel, { passive: false });
      return function () { document.removeEventListener("keydown", key); copy.remove(); };
    }, []);
    copy.style.width = size.w * k[0] + "px"; copy.style.height = size.h * k[0] + "px";
    return html`<div class="mm-overlay">
      <div class="mm-bar"><button type="button" title="크게" onClick=${function () { setK(k[0] * 1.25); }}>+</button><button type="button" title="작게" onClick=${function () { setK(k[0] / 1.25); }}>−</button><button type="button" title="화면에 맞춤" onClick=${fit}>맞춤</button><span class="mm-k">${Math.round(k[0] * 100)}%</span><button type="button" data-z="close" title="닫기 (Esc)" onClick=${props.onClose}>닫기</button></div>
      <div class="mm-stage" ref=${stage} onClick=${function (e) { if (e.target === stage.current) props.onClose(); }}></div>
    </div>`;
  }
  DS.Zoom = Zoom;
  function openWindow(svg) {
    var w = window.open("", "_blank");
    if (!w) return;
    var dark = document.documentElement.dataset.theme === "dark";
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + DS.esc(document.title) + ' · 그림</title><style>body{margin:0;padding:24px;background:' + (dark ? "#0d1117" : "#fff") + '}svg{max-width:none!important;height:auto}</style></head><body>' + svg.outerHTML + "</body></html>");
    w.document.close();
  }
  /* 확대 · 새 창 단추: 앱이 확대 창을 연다 (DS.emit("zoom", svg)) */
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("button.mm-zoom, button.mm-open");
    if (!b) return;
    var d = b.closest(".diagram"), svg = d && !d.classList.contains("bad") ? d.querySelector("pre.mermaid svg") : null;
    if (!svg) return;
    if (b.classList.contains("mm-zoom")) DS.emit("zoom", svg); else openWindow(svg);
  });

  /* 오른쪽 목차: 읽는 위치를 따라 강조할 절 id */
  DS.useSpy = function (toc, key) {
    var s = H.useState(toc[0] ? toc[0].sid : null);
    H.useEffect(function () {
      var raf = 0;
      function spy() {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(function () {
          var on = toc[0] ? toc[0].sid : null;
          for (var i = 0; i < toc.length; i++) { var h = document.getElementById(toc[i].sid); if (h && h.getBoundingClientRect().top < 120) on = toc[i].sid; }
          s[1](on);
        });
      }
      spy();
      window.addEventListener("scroll", spy, { passive: true });
      return function () { window.removeEventListener("scroll", spy); cancelAnimationFrame(raf); };
    }, [key]);
    return s[0];
  };
})();
/* ── 50-print.js ── */
/* 인쇄: 머리 줄 인쇄 단추 → 이 문서 · 전체 문서. 인쇄 때는 접힌 곳을 모두 편다 (Ctrl+P 도).
   전체 문서 인쇄 쪽(print-all.html): 메뉴 순서의 문서를 모두 읽어 본문을 이어 붙이고 그림을 그린 뒤 인쇄 창을 연다 */
(function () {
  "use strict";
  var DS = window.DS, html = DS.html, H = DS.hooks;
  window.addEventListener("beforeprint", function () { Array.prototype.forEach.call(document.querySelectorAll("details"), function (d) { d.open = true; }); });

  DS.PrintButton = function PrintButton(props) {
    var o = H.useState(false), open = o[0], setOpen = o[1];
    H.useEffect(function () {
      if (!open) return;
      function close() { setOpen(false); }
      function key(e) { if (e.key === "Escape") setOpen(false); }
      document.addEventListener("click", close);
      document.addEventListener("keydown", key);
      return function () { document.removeEventListener("click", close); document.removeEventListener("keydown", key); };
    }, [open]);
    return html`<button id="print" type="button" title="인쇄 (이 문서 · 전체 문서)" aria-label="인쇄" aria-haspopup="true" aria-expanded=${open} onClick=${function (e) { e.stopPropagation(); setOpen(!open); }}><${DS.Icon} paths=${DS.ICON.print} /></button>
      <div class="print-menu" hidden=${!open}>
        <button type="button" onClick=${function () { setOpen(false); props.ready().then(function () { window.print(); }); }}>이 문서 인쇄</button>
        <button type="button" onClick=${function () { setOpen(false); DS.go(DS.url("print-all.html")); }}>전체 문서 인쇄</button>
      </div>`;
  };

  /* 다른 쪽 본문의 상대 주소를 그 쪽 기준 절대 주소로 */
  function rebase(body, page) {
    var box = document.createElement("div"), base = DS.url(page);
    box.innerHTML = body;
    Array.prototype.forEach.call(box.querySelectorAll("[href],[src]"), function (n) {
      ["href", "src"].forEach(function (k) {
        var v = n.getAttribute(k);
        if (v && !/^(#|[a-z][a-z0-9+.-]*:)/i.test(v)) { try { n.setAttribute(k, new URL(v, base).href); } catch (e) { /* 그대로 */ } }
      });
    });
    return box.innerHTML;
  }

  DS.PrintAll = function PrintAll(props) {
    var s = H.useState({ docs: [], done: 0, total: 0, msg: "문서를 불러오는 중…", ready: false }), st = s[0], set = s[1];
    var box = H.useRef(null);
    H.useEffect(function () {
      if (DS.file) { set({ docs: [], msg: "전체 인쇄는 웹 주소(Pages 등)로 열었을 때만 됩니다. 이 PC 파일로 보고 있으면 aidure docs serve 로 여세요. 이 문서 인쇄는 그대로 됩니다." }); return; }
      var list = ((window.DS_SEARCH || {}).pages || []).map(function (p) { return p.u; }).filter(function (u, i, a) { return a.indexOf(u) === i && u !== "print-all.html"; });
      var out = [], next = 0, done = 0, alive = true;
      function one() {
        if (next >= list.length) return Promise.resolve();
        var i = next++;
        return DS.fetchPage(list[i]).then(function (d) { out[i] = { page: list[i], h1: d.meta.h1, body: rebase(d.body, list[i]) }; },
          function () { out[i] = { page: list[i], h1: DS.esc(list[i]), body: '<p class="mm-err">불러오지 못했습니다</p>' }; })
          .then(function () { done++; if (alive) set({ docs: [], done: done, total: list.length, msg: "문서를 불러오는 중 " + done + " / " + list.length }); return one(); });
      }
      var workers = [];
      for (var w = 0; w < 6; w++) workers.push(one());
      Promise.all(workers).then(function () {
        if (!alive) return;
        set({ docs: out, ready: true, msg: props.meta.autoPrint ? list.length + "개 문서. 인쇄 창을 엽니다 (다시 열기: 위 인쇄 단추 → 이 문서 인쇄)" : list.length + "개 문서를 모두 불러왔습니다. 위 인쇄 단추 → 이 문서 인쇄 (또는 Ctrl+P · ⌘P)" });
      });
      return function () { alive = false; };
    }, []);
    H.useEffect(function () {
      if (!st.ready || !box.current) return;
      DS.drawDiagrams(box.current).then(function () {
        Array.prototype.forEach.call(box.current.querySelectorAll("details"), function (d) { d.open = true; });
        if (props.meta.autoPrint) setTimeout(function () { window.print(); }, 300);
      });
    }, [st.ready]);
    return html`<div id="print-all" ref=${box}><p class="print-status">${st.msg}</p>
      ${st.docs.map(function (d) { return html`<section class="print-doc" key=${d.page}><h1 dangerouslySetInnerHTML=${{ __html: d.h1 }}></h1><div dangerouslySetInnerHTML=${{ __html: d.body }}></div></section>`; })}
    </div>`;
  };
})();
/* ── 60-ink.js ── */
/* 펜 필기: 머리 줄 펜 단추로 켜고 끈다 (쪽을 옮겨도 켜진 채). 펜 · 형광펜 · 지우개(획 지우기, 범위 원), 도구마다 색 5 · 크기 4단계,
   자(곧은 선), 되돌리기, 모두 지우기, PNG 받기. 선은 perfect-freehand 로 필압 · 속도에 따라 굵기가 바뀌는 채운 모양으로 그린다
   (펜이 아니면 속도로 필압을 흉내 낸다). 획은 본문(article) 기준 좌표로 이 기기에 쪽마다 저장하고(localStorage), SVG 층이라 인쇄에도 나온다.
   입력: 펜(Apple Pencil · S Pen)이 한 번이라도 닿았으면 펜 = 필기, 손가락 = 브라우저 스크롤 (확대는 막는다).
   펜이 없으면 한 손가락 = 필기, 두 손가락 = 화면 이동. 마우스 = 필기, 휠 = 그 자리 스크롤 */
(function () {
  "use strict";
  var DS = window.DS, html = DS.html, H = DS.hooks;
  var NS = "http://www.w3.org/2000/svg", root = document.documentElement;
  var PREF = "aidure-docs-ink-prefs";
  var TOOLS = {
    pen: { colors: ["var(--fg)", "#cf222e", "#0969da", "#1a7f37", "#bf5af2"], sizes: [2, 3.2, 5, 8] },
    hl: { colors: ["#ffd60a", "#7ee08a", "#7cc4ff", "#ff9ec7", "#ffb35c"], sizes: [10, 16, 22, 30] },
    er: { sizes: [6, 12, 22, 36] }
  };
  var ICO = {
    pen: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>',
    hl: '<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>',
    er: '<path d="M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.828 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21"/><path d="m5.082 11.09 8.828 8.828"/>',
    ruler: '<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/>',
    clear: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    png: '<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',
    close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'
  };
  var r1 = function (v) { return Math.round(v * 10) / 10; };

  /* 획 { t: pen|hl, c: 색, s: 크기, w: 그릴 때 본문 폭, p: [x, y, 필압, …], q: 펜 필압인가 }. 옛 획(d: [x, y, …])은 필압 0.5 로 읽는다 */
  function points(s) {
    if (s.p) { var o = []; for (var i = 0; i < s.p.length; i += 3) o.push([s.p[i], s.p[i + 1], s.p[i + 2]]); return o; }
    var d = s.d || [], out = [];
    for (var j = 0; j < d.length; j += 2) out.push([d[j], d[j + 1], 0.5]);
    return out;
  }
  function outline(s, done) {
    var pts = points(s), hl = s.t === "hl";
    return window.PerfectFreehand.getStroke(pts, {
      size: s.s, thinning: hl ? 0 : 0.55, smoothing: 0.5, streamline: s.r ? 0 : 0.45, simulatePressure: !s.q && !hl, last: done !== false,
      start: { cap: true, taper: 0 }, end: { cap: true, taper: 0 }
    });
  }
  /* 테두리 점 → SVG 경로 (중간점 2차 곡선) */
  function pathOf(o) {
    if (!o.length) return "";
    if (o.length < 3) return "M" + r1(o[0][0]) + " " + r1(o[0][1]) + "Z";
    var d = "M" + r1(o[0][0]) + " " + r1(o[0][1]) + " Q";
    for (var i = 0; i < o.length; i++) { var a = o[i], b = o[(i + 1) % o.length]; d += r1(a[0]) + " " + r1(a[1]) + " " + r1((a[0] + b[0]) / 2) + " " + r1((a[1] + b[1]) / 2) + " "; }
    return d + "Z";
  }

  DS.Ink = function Ink(props) {
    /* props: on, setOn, el(본문 article), page(쪽 경로: 저장 키) */
    var pref = H.useMemo(function () { return DS.load(PREF, {}) || {}; }, []);
    var ts = H.useState(TOOLS[pref.tool] ? pref.tool : "pen"), tool = ts[0], setTool = ts[1];
    var cs = H.useState(pref.color || {}), color = cs[0], setColor = cs[1];
    var ss = H.useState(pref.size || {}), size = ss[0], setSize = ss[1];
    var rs = H.useState(!!pref.ruler), ruler = rs[0], setRuler = rs[1];
    var ver = H.useState(0), bump = function () { ver[1](function (n) { return n + 1; }); };
    var layer = H.useRef(null), ring = H.useRef(null);
    var S = H.useRef({ strokes: [], hist: [], key: "" }).current;   /* 그리는 중 상태는 다시 그리지 않으려 ref 에 */
    S.tool = tool; S.ruler = ruler;
    S.sizeOf = function () { return TOOLS[S.tool].sizes[size[S.tool] == null ? 1 : size[S.tool]]; };
    S.colorOf = function () { return TOOLS[S.tool].colors[color[S.tool] || 0]; };
    var penSeen = H.useRef(!!pref.pen);
    function savePref(extra) { DS.keep(PREF, Object.assign({ tool: tool, color: color, size: size, ruler: ruler, pen: penSeen.current || undefined }, extra || {})); }

    /* 필기 층: 본문(article) 끝에 SVG 하나 (앱이 그리는 본문과 따로, 쪽을 옮겨도 그대로) */
    H.useLayoutEffect(function () {
      if (!props.el) return;
      var L = document.createElementNS(NS, "svg");
      L.setAttribute("class", "ink-layer");
      L.setAttribute("aria-hidden", "true");
      props.el.appendChild(L);
      layer.current = L;
      return function () { L.remove(); layer.current = null; };
    }, [props.el]);
    /* 쪽이 바뀌면 그 쪽 획을 읽는다 (새 본문과 같은 화면에: 앞 쪽 획이 잠깐 보이지 않게) */
    H.useLayoutEffect(function () {
      S.key = "aidure-docs-ink:" + new URL(DS.url(props.page)).pathname;
      var v = DS.load(S.key, []);
      S.strokes = Array.isArray(v) ? v : [];
      S.hist = [];
      S.render();
      bump();
    }, [props.page]);
    H.useLayoutEffect(function () { root.classList.toggle("ink-on", props.on); if (props.on) S.render(); else if (ring.current) ring.current.classList.remove("on"); }, [props.on]);
    H.useLayoutEffect(function () { root.classList.toggle("ink-erase", tool === "er"); }, [tool]);
    H.useEffect(function () { if (penSeen.current) root.classList.add("ink-pen"); }, []);

    var W = function () { return (props.el && props.el.offsetWidth) || 1; };
    function el(s, done) {
      var e = document.createElementNS(NS, "path");
      e.setAttribute("d", pathOf(outline(s, done)));
      if (s.t === "hl") e.setAttribute("class", "hl");
      e.style.fill = s.c;
      var k = W() / (s.w || W());
      if (Math.abs(k - 1) > 0.001) e.setAttribute("transform", "scale(" + k + ")");
      return e;
    }
    S.render = function () {
      var L = layer.current, page = props.el;
      if (!L || !page) return;
      // 높이는 층을 뺀 본문으로 잰다 (층이 들어간 채 재면 긴 쪽에서 짧은 쪽으로 옮겨도 줄지 않고 아래에 빈 공간이 남는다)
      L.style.display = "none";
      var h = Math.max(page.scrollHeight, page.offsetHeight);
      L.style.display = "";
      L.setAttribute("width", W());
      L.setAttribute("height", h);
      while (L.firstChild) L.removeChild(L.firstChild);
      S.strokes.forEach(function (s) { L.appendChild(el(s)); });
      if (S.curEl) L.appendChild(S.curEl);
    };
    S.save = function () { DS.keep(S.key, S.strokes.length ? S.strokes : null); bump(); };
    S.snap = function () { S.hist.push(JSON.stringify(S.strokes)); if (S.hist.length > 50) S.hist.shift(); };
    function undo() { if (!S.hist.length) return; S.strokes = JSON.parse(S.hist.pop()); S.render(); S.save(); }

    /* 본문 크기가 바뀌면(창 · 펼침 · 그림 · 인쇄) 다시 그린다 */
    H.useEffect(function () {
      if (!props.el) return;
      var again = function () { requestAnimationFrame(S.render); };
      var ro = window.ResizeObserver ? new ResizeObserver(again) : null;
      if (ro) ro.observe(props.el); else window.addEventListener("resize", again);
      window.addEventListener("beforeprint", S.render);
      window.addEventListener("afterprint", again);
      return function () { if (ro) ro.disconnect(); else window.removeEventListener("resize", again); window.removeEventListener("beforeprint", S.render); window.removeEventListener("afterprint", again); };
    }, [props.el]);

    /* Esc = 끝내기 · ⌘Z = 되돌리기 (잡기 단계: 다른 스크립트가 막아도 듣는다). 한 번만 걸고 지금 값은 ref 로 */
    var live = H.useRef(props);
    live.current = props;
    H.useEffect(function () {
      function key(e) {
        if (!root.classList.contains("ink-on")) return;
        if (e.key === "Escape" || e.key === "Esc" || e.keyCode === 27) { e.preventDefault(); live.current.setOn(false); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); }
        else if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
      }
      window.addEventListener("keydown", key, true);
      return function () { window.removeEventListener("keydown", key, true); };
    }, []);

    /* 입력 (필기를 켠 동안). 층에 한 번만 건다 */
    H.useEffect(function () {
      var L = layer.current;
      if (!L) return;
      var cur = null, curId = null, curTouch = false, erased = false, erLast = null, penDown = false;
      var fingers = {}, pan = null, vel = [0, 0], lastT = 0, fling = 0, glideAt = [0, 0];
      var on = function () { return root.classList.contains("ink-on"); };
      function markPen() { if (!penSeen.current) { penSeen.current = true; root.classList.add("ink-pen"); var p = DS.load(PREF, {}) || {}; p.pen = true; DS.keep(PREF, p); } }
      /* iPad Safari 는 SVG 의 touch-action 을 다 따르지 않아 막을 터치는 터치 이벤트에서 직접 막는다 */
      function block(e) {
        if (!on()) return;
        var stylus = false;
        for (var i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].touchType === "stylus") { stylus = true; markPen(); }
        if (penSeen.current && !stylus && !penDown) return;
        if (e.cancelable) e.preventDefault();
      }
      var nFingers = function () { return Object.keys(fingers).length; };
      function centroid() { var x = 0, y = 0, n = 0; for (var k in fingers) { x += fingers[k][0]; y += fingers[k][1]; n++; } return [x / n, y / n]; }
      function at(e) { var r = props.el.getBoundingClientRect(); return [r1(e.clientX - r.left), r1(e.clientY - r.top)]; }
      function pressure(e) { return e.pointerType === "pen" && e.pressure > 0 ? Math.round(e.pressure * 100) / 100 : 0.5; }
      function segDist(px, py, ax, ay, bx, by) {
        var dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0;
        return Math.hypot(px - ax - t * dx, py - ay - t * dy);
      }
      function eraseAt(x, y) {
        var r = S.sizeOf(), w = W(), before = S.strokes.length;
        S.strokes = S.strokes.filter(function (s) {
          var k = w / (s.w || w), p = points(s), lim = r + (s.s * k) / 2;
          if (p.length < 2) return !p.length || Math.hypot(x - p[0][0] * k, y - p[0][1] * k) > lim;
          for (var i = 0; i < p.length - 1; i++) if (segDist(x, y, p[i][0] * k, p[i][1] * k, p[i + 1][0] * k, p[i + 1][1] * k) <= lim) return false;
          return true;
        });
        if (S.strokes.length !== before) { if (!erased) { S.hist.push(JSON.stringify(cur)); erased = true; } S.render(); }
      }
      function eraseTo(x, y) {   /* 지우개가 지난 길 전체 (빠르게 움직여도 사이의 획을 놓치지 않는다) */
        if (erLast) { var dx = x - erLast[0], dy = y - erLast[1], n = Math.ceil(Math.hypot(dx, dy) / Math.max(2, S.sizeOf() / 2));
          for (var i = 1; i < n; i++) eraseAt(erLast[0] + dx * i / n, erLast[1] + dy * i / n); }
        eraseAt(x, y); erLast = [x, y];
      }
      function showRing(e) {
        if (S.tool !== "er" || !ring.current) return;
        var d = S.sizeOf() * 2, g = ring.current;
        g.style.width = g.style.height = d + "px";
        g.style.left = e.clientX + "px"; g.style.top = e.clientY + "px";
        g.classList.add("on");
      }
      /* 자: 시작점에서 지금 점까지 곧은 선. 가로 · 세로 · 45° 근처(6° 안)면 그 각으로 붙인다 */
      function straight(p, pr) {
        var x0 = cur.p[0], y0 = cur.p[1], dx = p[0] - x0, dy = p[1] - y0, len = Math.hypot(dx, dy);
        if (len) { var ang = Math.atan2(dy, dx), step = Math.PI / 4, near = Math.round(ang / step) * step;
          if (Math.abs(ang - near) < Math.PI / 30) { dx = len * Math.cos(near); dy = len * Math.sin(near); } }
        return [x0, y0, cur.p[2], r1(x0 + dx), r1(y0 + dy), pr];
      }
      function start(e) {
        try { L.setPointerCapture(e.pointerId); } catch (x) { /* 없음 */ }
        curId = e.pointerId; curTouch = e.pointerType === "touch";
        var p = at(e);
        if (S.tool === "er") { cur = S.strokes.slice(); erased = false; erLast = null; eraseTo(p[0], p[1]); showRing(e); return; }
        cur = { t: S.tool, c: S.colorOf(), s: S.sizeOf(), w: W(), q: e.pointerType === "pen" || undefined, p: [p[0], p[1], pressure(e)] };
        S.curEl = el(cur, false);
        L.appendChild(S.curEl);
      }
      function drop() {   /* 두 번째 손가락: 첫 손가락이 긋던 획 · 지우던 것을 되돌린다 */
        if (!cur) return;
        if (S.tool === "er") { if (erased) { S.strokes = cur; S.hist.pop(); S.render(); } }
        else if (S.curEl) S.curEl.remove();
        cur = null; S.curEl = null; curId = null; erased = false;
      }
      /* 스크롤은 손가락 · 펜 · 마우스가 있는 자리의 요소로: 필기 층 아래에서 위로 올라가며 그 방향으로 더 움직일 수 있는 첫 스크롤 상자, 없으면 창 */
      function under(x, y) {
        var list = document.elementsFromPoint ? document.elementsFromPoint(x, y) : [];
        for (var i = 0; i < list.length; i++) if (list[i] !== L && !L.contains(list[i])) return list[i];
        return null;
      }
      function canScroll(n, ax, d) {
        var o = getComputedStyle(n)[ax === "x" ? "overflowX" : "overflowY"];
        if (!/auto|scroll|overlay/.test(o)) return false;
        if (ax === "x") return d > 0 ? n.scrollLeft + n.clientWidth < n.scrollWidth - 1 : n.scrollLeft > 0;
        return d > 0 ? n.scrollTop + n.clientHeight < n.scrollHeight - 1 : n.scrollTop > 0;
      }
      function scrollAt(x, y, dx, dy) {
        var t = under(x, y);
        [["x", dx], ["y", dy]].forEach(function (a) {
          var ax = a[0], d = a[1];
          if (!d) return;
          for (var n = t; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
            if (canScroll(n, ax, d)) { if (ax === "x") n.scrollLeft += d; else n.scrollTop += d; return; }
          }
          window.scrollBy(ax === "x" ? d : 0, ax === "y" ? d : 0);
        });
      }
      function wheel(e) {
        if (!on() || e.ctrlKey) return;
        var k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1, dx = e.deltaX * k, dy = e.deltaY * k;
        if (e.shiftKey && !dx) { dx = dy; dy = 0; }
        e.preventDefault();
        scrollAt(e.clientX, e.clientY, dx, dy);
      }
      function glide() {
        cancelAnimationFrame(fling);
        var step = function () {
          vel = [vel[0] * 0.92, vel[1] * 0.92];
          if (Math.abs(vel[0]) < 0.02 && Math.abs(vel[1]) < 0.02) return;
          scrollAt(glideAt[0], glideAt[1], -vel[0] * 16, -vel[1] * 16);
          fling = requestAnimationFrame(step);
        };
        fling = requestAnimationFrame(step);
      }
      function down(e) {
        e.preventDefault();
        cancelAnimationFrame(fling);
        if (e.pointerType === "pen") { markPen(); penDown = true; if (!cur) start(e); return; }
        if (e.pointerType === "mouse") { if (e.button === 0 && !cur) start(e); return; }
        if (penSeen.current) return;   /* 손가락 = 브라우저 기본 스크롤 */
        fingers[e.pointerId] = [e.clientX, e.clientY];
        try { L.setPointerCapture(e.pointerId); } catch (x) { /* 없음 */ }
        if (nFingers() >= 2) { if (cur && curTouch) drop(); pan = centroid(); vel = [0, 0]; lastT = e.timeStamp; return; }
        if (!cur) start(e);
      }
      function move(e) {
        if (e.pointerType === "touch" && fingers[e.pointerId]) {
          var o = fingers[e.pointerId], n = Math.min(2, nFingers());
          fingers[e.pointerId] = [e.clientX, e.clientY];
          if (pan && n >= 2) {
            /* 움직인 손가락 하나의 이동 / 2 = 가운데 점의 이동 (손가락이 닿고 떨어져도 튀지 않는다) */
            var dx = (e.clientX - o[0]) / n, dy = (e.clientY - o[1]) / n, dt = e.timeStamp - lastT;
            pan = centroid();
            if (!dx && !dy) return;
            scrollAt(pan[0], pan[1], -dx, -dy);
            if (dt > 0) { var a = Math.min(1, dt / 50), cap = function (v) { return Math.max(-3, Math.min(3, v)); };
              vel = [vel[0] + (cap(dx * n / Math.max(dt, 8)) - vel[0]) * a, vel[1] + (cap(dy * n / Math.max(dt, 8)) - vel[1]) * a]; lastT = e.timeStamp; }
            return;
          }
        }
        if (e.pointerType !== "touch") showRing(e);
        if (!cur || e.pointerId !== curId) return;
        var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
        if (!evs.length) evs = [e];
        if (S.tool === "er") { evs.forEach(function (ev) { var p = at(ev); eraseTo(p[0], p[1]); }); return; }
        if (S.ruler || e.shiftKey) { var last = evs[evs.length - 1]; cur.p = straight(at(last), pressure(last)); cur.r = 1; }
        else evs.forEach(function (ev) {
          var p = at(ev), d = cur.p, lx = d[d.length - 3], ly = d[d.length - 2];
          if (Math.hypot(p[0] - lx, p[1] - ly) >= 1) d.push(p[0], p[1], pressure(ev));
        });
        if (S.curEl) S.curEl.setAttribute("d", pathOf(outline(cur, false)));
      }
      function end(e) {
        if (e.pointerType === "pen") penDown = false;
        if (e.pointerType === "touch" && fingers[e.pointerId]) {
          delete fingers[e.pointerId];
          if (pan && nFingers() < 2) { glideAt = pan; pan = null; if (e.timeStamp - lastT < 80) glide(); }
        }
        if (!cur || e.pointerId !== curId) return;
        if (S.tool === "er") { if (erased) S.save(); }
        else { S.snap(); if (cur.r) delete cur.r; S.strokes.push(cur); S.curEl = null; S.render(); S.save(); }
        cur = null; S.curEl = null; curId = null; erased = false;
      }
      function leave() { if (ring.current) ring.current.classList.remove("on"); }
      L.addEventListener("touchstart", block, { passive: false });
      L.addEventListener("touchmove", block, { passive: false });
      L.addEventListener("wheel", wheel, { passive: false });
      L.addEventListener("pointerdown", down);
      L.addEventListener("pointermove", move);
      L.addEventListener("pointerup", end);
      L.addEventListener("pointercancel", end);
      L.addEventListener("pointerleave", leave);
      return function () {
        L.removeEventListener("touchstart", block); L.removeEventListener("touchmove", block); L.removeEventListener("wheel", wheel);
        L.removeEventListener("pointerdown", down); L.removeEventListener("pointermove", move); L.removeEventListener("pointerup", end);
        L.removeEventListener("pointercancel", end); L.removeEventListener("pointerleave", leave);
        cancelAnimationFrame(fling);
      };
    }, [props.el]);

    /* PNG: 필기 층만 본문 크기 그대로 (배경 = 지금 테마 색). 큰 쪽은 브라우저 한도 안으로 줄인다 */
    function png() {
      var page = props.el, L = layer.current, w = W(), h = Number(L.getAttribute("height")) || page.offsetHeight, cs = getComputedStyle(document.body);
      var k = Math.min(2, 16384 / w, 16384 / h, Math.sqrt(16e6 / (w * h)));
      var copy = L.cloneNode(true), fg = getComputedStyle(root).getPropertyValue("--fg").trim() || "#1f2328";
      copy.setAttribute("xmlns", NS);
      copy.setAttribute("viewBox", "0 0 " + w + " " + h);
      copy.removeAttribute("class");
      Array.prototype.forEach.call(copy.querySelectorAll("path"), function (n) {
        if (n.style.fill.indexOf("var(") >= 0) n.style.fill = fg;
        if (n.getAttribute("class") === "hl") n.style.opacity = ".5";
      });
      var img = new Image();
      img.onload = function () {
        var c = document.createElement("canvas");
        c.width = Math.round(w * k); c.height = Math.round(h * k);
        var g = c.getContext("2d");
        g.fillStyle = cs.backgroundColor || "#fff"; g.fillRect(0, 0, c.width, c.height);
        g.drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(function (b) {
          if (!b) return;
          var a = document.createElement("a");
          a.href = URL.createObjectURL(b);
          var h1 = page.querySelector("h1");
          a.download = ((h1 && h1.textContent) || document.title).trim().replace(/[\\/:*?"<>|]+/g, " ").slice(0, 80) + " 필기.png";
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
        }, "image/png");
      };
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(copy));
    }

    var t = TOOLS[tool];
    var pick = function (fn) { return function () { fn(); }; };
    H.useEffect(function () { savePref(); }, [tool, color, size, ruler]);
    var bar = html`<div class="ink-bar" role="toolbar" aria-label="펜 필기 도구">
      ${["pen", "hl", "er"].map(function (k) { return html`<button type="button" key=${k} class=${k === tool ? "on" : ""} title=${{ pen: "펜", hl: "형광펜", er: "지우개" }[k]} aria-pressed=${k === tool} onClick=${pick(function () { setTool(k); })}><${DS.Icon} paths=${ICO[k]} /></button>`; })}
      ${t.colors ? html`<span class="ink-sep"></span>${t.colors.map(function (c, i) {
        return html`<button type="button" key=${"c" + i} class=${"ink-c" + (i === (color[tool] || 0) ? " on" : "")} title=${"색 " + (i + 1)} style=${"--c:" + c} onClick=${pick(function () { var n = Object.assign({}, color); n[tool] = i; setColor(n); })}><i></i></button>`;
      })}` : null}
      <span class="ink-sep"></span>
      ${t.sizes.map(function (v, i) {
        var dot = Math.round(4 + i * 3.5);
        return html`<button type="button" key=${"s" + i} class=${"ink-s" + (i === (size[tool] == null ? 1 : size[tool]) ? " on" : "")} title=${"크기 " + (i + 1)} onClick=${pick(function () { var n = Object.assign({}, size); n[tool] = i; setSize(n); })}><i style=${{ width: dot + "px", height: dot + "px" }}></i></button>`;
      })}
      <span class="ink-sep"></span>
      <button type="button" class=${ruler ? "on" : ""} aria-pressed=${ruler} title="자: 곧은 선 (가로 · 세로 · 45° 에 붙음. 마우스는 Shift 를 누른 동안도)" onClick=${pick(function () { setRuler(!ruler); })}><${DS.Icon} paths=${ICO.ruler} /></button>
      <button type="button" title="되돌리기 (⌘Z · Ctrl+Z)" disabled=${!S.hist.length} onClick=${undo}><${DS.Icon} paths=${ICO.undo} /></button>
      <button type="button" title="이 쪽 필기 모두 지우기 (되돌리기로 살린다)" disabled=${!S.strokes.length} onClick=${function () { S.snap(); S.strokes = []; S.render(); S.save(); }}><${DS.Icon} paths=${ICO.clear} /></button>
      <button type="button" title="필기 PNG 받기" disabled=${!S.strokes.length} onClick=${png}><${DS.Icon} paths=${ICO.png} /></button>
      <button type="button" title="필기 끝내기 (Esc)" onClick=${function () { props.setOn(false); }}><${DS.Icon} paths=${ICO.close} /></button>
    </div>`;
    /* 막대 · 지우개 원은 화면에 고정 */
    return html`<div class="ink-eraser" ref=${ring}></div>${bar}`;
  };
})();
/* ── 90-app.js ── */
/* 앱: 머리 줄(☰ · 이름 · 검색 · 버전 · 필기 · 인쇄 · 테마) · 왼쪽 메뉴 · 본문 · 오른쪽 목차 · 이전/다음.
   쪽 정보(meta)로 그리고 본문(.ds-body)은 그 쪽의 HTML 그대로. 근거 패널(iframe) 안이면 본문만 */
(function () {
  "use strict";
  var DS = window.DS, html = DS.html, H = DS.hooks;
  var mount = document.getElementById("ds-app");
  var first = DS.readDoc(document);
  if (!mount || !first) return;   /* 쪽 정보가 없는 옛 쪽: 정적 HTML 그대로 */

  function Head(props) {
    var m = props.meta;
    return html`<div class="page-head"><div>
        <div class="crumb">${m.crumb}${m.status ? html` <span class="ds-badge" data-status=${m.status}>${m.status}</span>` : null}</div>
        <h1 dangerouslySetInnerHTML=${{ __html: m.h1 }}></h1>
        ${m.lead ? html`<p class="lead" dangerouslySetInnerHTML=${{ __html: m.lead }}></p>` : null}
      </div>${m.src ? html`<a class="src" href=${m.src.href} title="원본 md">원본 ${m.src.name}</a>` : null}</div>`;
  }

  function Toc(props) {
    var toc = props.meta.toc || [], on = DS.useSpy(toc, props.meta.page);
    return html`<aside class="toc"><div class="toc-title">이 페이지</div><div id="toc">
      ${toc.length ? toc.map(function (x) { return html`<a key=${x.sid} class=${"l" + x.lvl + (x.sid === on ? " on" : "")} href=${"#" + x.sid}>${x.text}</a>`; }) : html`<div class="empty">${props.meta.title}</div>`}
    </div></aside>`;
  }

  function Pager(props) {
    var m = props.meta;
    if (!m.prev && !m.next) return null;
    var one = function (d, cls, label) { return d ? html`<a class=${cls} href=${DS.url(d.p)}><small>${label} · ${d.g}</small>${d.t}</a>` : html`<span></span>`; };
    return html`<div class="pager">${one(m.prev, "prev", "이전")}${one(m.next, "next", "다음")}</div>`;
  }

  function App() {
    var ps = H.useState({ d: first, hash: location.hash, y: (history.state && history.state.y) || 0, n: 0 }), cur = ps[0], setCur = ps[1];
    var meta = cur.d.meta, site = meta.site || {};
    var ns = H.useState(false), navOpen = ns[0], setNav = ns[1];
    var narrow = DS.useNarrow();
    var ts = H.useState(document.documentElement.dataset.theme || "light"), theme = ts[0], setTheme = ts[1];
    var is = H.useState(false), ink = is[0], setInk = is[1];
    var zs = H.useState(null), zoom = zs[0], setZoom = zs[1];
    var art = H.useRef(null), bodyEl = H.useRef(null);
    var as = H.useState(null), artEl = as[0], setArtEl = as[1];
    var ready = H.useRef(Promise.resolve());

    H.useEffect(function () {
      DS.onRoute(function (d, opt) { setNav(false); setCur({ d: d, hash: opt.hash, y: opt.y, n: Math.random() }); });
      DS.on("zoom", function (svg) { setZoom(svg); });
      setArtEl(art.current);
    }, []);
    /* 새 쪽을 그린 뒤: 제목 · 위치(#ID 는 펼쳐서 · 뒤로 가기는 그 자리) · 그림 · 덧붙임 스크립트 */
    H.useLayoutEffect(function () {
      document.title = meta.head || meta.title;
      if (!(cur.hash && DS.reveal(cur.hash, true))) window.scrollTo(0, cur.y || 0);
      ready.current = DS.drawDiagrams(bodyEl.current);
      DS.emit("page", { el: art.current, meta: meta });
    }, [cur]);
    /* 테마: 기본 라이트, 바꾼 값만 기억 (ERD 뷰어와 같은 키). 그림은 새 색으로 다시 */
    H.useEffect(function () {
      if (document.documentElement.dataset.theme === theme) return;
      document.documentElement.dataset.theme = theme;
      try { localStorage.setItem("aidure-docs-theme", theme); } catch (e) { /* 저장 못 함 */ }
      ready.current = DS.drawDiagrams(bodyEl.current);
      DS.emit("theme", theme);
    }, [theme]);
    /* 좁은 화면 서랍: 본문 스크롤 잠금은 html 에 (body 에 걸면 고정 머리 띠가 밀려난다) */
    H.useEffect(function () {
      document.body.classList.toggle("nav-open", navOpen);
      document.documentElement.classList.toggle("nav-open", navOpen);
      if (!navOpen) return;
      var key = function (e) { if (e.key === "Escape") setNav(false); };
      document.addEventListener("keydown", key);
      return function () { document.removeEventListener("keydown", key); };
    }, [navOpen]);
    H.useEffect(function () { if (!narrow) setNav(false); }, [narrow]);

    var isPrint = meta.kind === "print";
    var body = isPrint ? html`<div class="ds-body" ref=${bodyEl}><${DS.PrintAll} key=${cur.n} meta=${meta} /></div>`
      : html`<div class="ds-body" ref=${bodyEl} dangerouslySetInnerHTML=${{ __html: cur.d.body }}></div>`;
    var article = html`<main id="main"><article class="page" ref=${art}>${isPrint ? null : html`<${Head} meta=${meta} />`}${body}</article>${DS.embedded || isPrint ? null : html`<${Pager} meta=${meta} />`}</main>`;
    if (DS.embedded) return html`<div class="layout">${article}</div>`;
    var search = html`<${DS.Search} />`;
    return html`<header>
        <div class="left"><button class="menu-btn" id="menu" type="button" aria-label="메뉴" aria-expanded=${navOpen} aria-controls="side-nav" onClick=${function () { setNav(!navOpen); }}>${navOpen ? "✕" : "☰"}</button><a class="brand" href=${DS.url("index.html")}><span class="logo">${site.logo}</span>${site.title}</a></div>
        ${narrow ? null : search}
        <div class="tools"><span>${site.version}</span>
          ${site.ink && !isPrint ? html`<button id="ink" type="button" title="펜 필기 (끝내기: Esc)" aria-label="펜 필기" aria-pressed=${ink} onClick=${function () { setInk(!ink); }}><${DS.Icon} paths=${DS.ICON.ink} /></button>` : null}
          <${DS.PrintButton} ready=${function () { return ready.current; }} />
          <button id="theme" type="button" title="테마" aria-label="테마" onClick=${function () { setTheme(theme === "dark" ? "light" : "dark"); }}><${DS.Icon} paths=${DS.ICON.theme} /></button>
        </div>
      </header>
      <div class="layout">
        <${DS.Nav} page=${meta.page} search=${narrow ? search : null} onPick=${function () { setNav(false); }} />
        <div class="nav-backdrop" id="nav-backdrop" onClick=${function () { setNav(false); }}></div>
        ${article}
        <${Toc} meta=${meta} />
      </div>
      ${site.ink && artEl && !isPrint ? html`<${DS.Ink} on=${ink} setOn=${setInk} el=${artEl} page=${meta.page} />` : null}
      ${zoom ? html`<${DS.Zoom} svg=${zoom} onClose=${function () { setZoom(null); }} />` : null}`;
  }

  mount.textContent = "";
  DS.render(html`<${App} />`, mount);
  document.documentElement.classList.add("ds-app");   /* 앱이 그림 (시험 · 덧붙임 스크립트가 기다릴 표시) */
})();
