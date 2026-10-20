/* 문서 사이트(aikit docs build · aikit board) 공통 스크립트: 테마 · 검색(⌘K) · 목차 따라가기 · 코드 복사 · #ID 로 열 때 펼치고 강조 · mermaid 그림 · 펜 필기. 킷 가이드와 같은 동작 */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var ROOT = document.body.getAttribute("data-root") || "./";   /* 빈 값이면 ./ : 쪽 이름이 javascript: 처럼 보여도 주소 체계로 읽히지 않게 */
  /* 화면설계서 근거 패널(iframe) 안에서는 본문만 */
  try { if (window.self !== window.top) document.documentElement.classList.add("embedded"); } catch (e) { document.documentElement.classList.add("embedded"); }

  /* 왼쪽 메뉴: assets/nav.js(window.DS_NAV) 를 그린다. 주소를 이 쪽 기준으로 · 지금 문서 표시 · 접힌 묶음/폴더는 지금 문서가 든 것만 펴고, 바꾼 상태는 사이트별로 기억 */
  (function () {
    var side = document.getElementById("side-nav"), N = window.DS_NAV;
    if (!side || !N || !N.html || !side.hasAttribute("data-page")) return;
    var cur = side.getAttribute("data-page");
    side.innerHTML = N.html;
    $$("a[data-p]", side).forEach(function (a) {
      var h = a.getAttribute("data-h");
      a.setAttribute("href", ROOT + a.getAttribute("data-p") + (h ? "#" + h : ""));
      if (a.classList.contains("nav-link") && a.getAttribute("data-p") === cur) a.classList.add("on");
    });
    var folds = $$("details[data-k]", side);
    if (!folds.length) return;
    var KEY = "aikit-docs-nav:" + (N.key || ""), st = {};
    try { st = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { st = {}; }
    var save = function () { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };
    folds.forEach(function (d) {
      var k = d.getAttribute("data-k");
      if (Object.prototype.hasOwnProperty.call(st, k)) d.open = !!st[k];
      if (d.querySelector(".nav-link.on")) d.open = true;   /* 지금 문서가 든 묶음 · 폴더는 늘 편다 */
      d.addEventListener("toggle", function () { st[k] = d.open; save(); });
    });
    /* 모두 펴기 · 모두 접기 */
    var tools = document.createElement("div");
    tools.className = "nav-tools";
    tools.innerHTML = '<button type="button" data-a="open">모두 펴기</button><button type="button" data-a="close">모두 접기</button>';
    tools.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("button");
      if (!b) return;
      var on = b.getAttribute("data-a") === "open";
      folds.forEach(function (d) { d.open = on || !!d.querySelector(".nav-link.on"); st[d.getAttribute("data-k")] = d.open; });
      save();
    });
    side.insertBefore(tools, side.firstChild);
    var c = side.querySelector(".nav-link.on");
    if (c && c.scrollIntoView) c.scrollIntoView({ block: "nearest" });
  })();

  /* 좁은 화면 메뉴: ☰ 로 서랍을 열고, 링크 · 바깥 · Esc · 넓은 화면으로 바뀌면 닫는다 */
  (function () {
    var mb = document.getElementById("menu"), side = document.getElementById("side-nav"), bd = document.getElementById("nav-backdrop");
    if (!mb || !side) return;
    function setNav(on) {
      document.body.classList.toggle("nav-open", on);
      document.documentElement.classList.toggle("nav-open", on);   /* 본문 스크롤 잠금은 html 에 (body 에 걸면 고정 머리 띠가 밀려난다) */
      mb.setAttribute("aria-expanded", String(on));
      mb.textContent = on ? "✕" : "☰";
      if (on) { var c = side.querySelector(".nav-link.on"); if (c) c.scrollIntoView({ block: "center" }); }
    }
    mb.addEventListener("click", function () { setNav(!document.body.classList.contains("nav-open")); });
    if (bd) bd.addEventListener("click", function () { setNav(false); });
    side.addEventListener("click", function (e) { if (e.target.closest && e.target.closest("a")) setNav(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && document.body.classList.contains("nav-open")) setNav(false); });
    /* 검색창: 좁은 화면에서는 서랍 맨 위로 옮기고, 넓어지면 머리 띠로 돌려놓는다 */
    var sb = document.querySelector("header .search"), home = sb && sb.nextElementSibling;
    function place(wide) {
      if (!sb) return;
      if (wide) { if (sb.parentNode !== home.parentNode) home.parentNode.insertBefore(sb, home); setNav(false); }
      else if (sb.parentNode !== side) side.insertBefore(sb, side.firstChild);
    }
    var mq = window.matchMedia && window.matchMedia("(min-width: 761px)");
    if (mq) {
      place(mq.matches);
      var onMq = function (e) { place(e.matches); };
      if (mq.addEventListener) mq.addEventListener("change", onMq); else mq.addListener(onMq);
    }
  })();

  /* 테마: 기본 라이트, 바꾼 값만 기억한다 (가이드와 같은 키) */
  var tb = $("#theme");
  if (tb) tb.onclick = function () {
    var t = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem("aikit-docs-theme", t); } catch (e) {}
    drawDiagrams();
  };

  /* 검색: 쪽 제목 · 소제목 · 정의 ID (assets/search.js 의 window.DS_SEARCH) */
  var q = $("#q"), res = $("#results"), hits = [], sel = 0;
  var esc = function (s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); };
  function search() {
    var v = q.value.trim().toLowerCase(), S = window.DS_SEARCH || { pages: [], ids: [] };
    if (!v) { res.style.display = "none"; return; }
    hits = [];
    S.ids.forEach(function (x) { if (x[0].toLowerCase().indexOf(v) === 0) hits.push({ href: ROOT + x[1], t: x[0], s: x[2], k: "ID" }); });
    S.pages.forEach(function (p) {
      if ((p.t + " " + p.g).toLowerCase().indexOf(v) >= 0) hits.push({ href: ROOT + p.u, t: p.t, s: p.g, k: "문서" });
      p.h.forEach(function (h) { if (h[1].toLowerCase().indexOf(v) >= 0) hits.push({ href: ROOT + p.u + "#" + h[0], t: h[1], s: p.g + " › " + p.t, k: "절" }); });
    });
    hits = hits.slice(0, 30); sel = 0;
    res.innerHTML = hits.length ? hits.map(function (h, i) {
      return '<a href="' + esc(h.href) + '" class="' + (i === 0 ? "on" : "") + '"><span class="kind">' + h.k + "</span>" + esc(h.t) + "<small>" + esc(h.s) + "</small></a>";
    }).join("") : "<a>결과 없음</a>";
    res.style.display = "block";
  }
  if (q) {
    q.addEventListener("input", search);
    q.addEventListener("keydown", function (e) {
      var as = $$("a", res);
      if ((e.key === "ArrowDown" || e.key === "ArrowUp") && as.length) {
        e.preventDefault(); sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + as.length) % as.length;
        as.forEach(function (a, i) { a.classList.toggle("on", i === sel); });
      }
      if (e.key === "Enter" && hits[sel]) { location.href = hits[sel].href; q.value = ""; res.style.display = "none"; }
      if (e.key === "Escape") { q.value = ""; res.style.display = "none"; q.blur(); }
    });
    document.addEventListener("keydown", function (e) { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); q.focus(); } });
    document.addEventListener("click", function (e) { if (!e.target.closest(".search")) res.style.display = "none"; });
  }

  /* 오른쪽 목차: 읽는 위치를 따라 강조 */
  function spy() {
    var links = $$("#toc a[data-id]"), on = null;
    links.forEach(function (a) { var h = document.getElementById(a.dataset.id); if (h && h.getBoundingClientRect().top < 120) on = a; });
    links.forEach(function (a) { a.classList.toggle("on", a === (on || links[0])); });
  }
  addEventListener("scroll", spy, { passive: true });
  spy();
  var cur = $(".nav-link.on");
  if (cur) cur.scrollIntoView({ block: "nearest" });

  /* 코드 복사 */
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("button.copy");
    if (!b || !navigator.clipboard) return;
    navigator.clipboard.writeText(b.nextElementSibling.textContent).then(function () { b.textContent = "복사됨"; setTimeout(function () { b.textContent = "복사"; }, 1200); });
  });

  /* #ID 로 열 때(다른 문서 · 화면설계서 근거 링크): 접힌 곳을 펼치고 그 위치로 가서 강조 */
  function reveal(scroll) {
    if (!location.hash) return;
    var id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch (e) { return; }
    var t = document.getElementById(id);
    if (!t) return;
    for (var p = t; p; p = p.parentElement) if (p.tagName === "DETAILS") p.open = true;   /* 결정 기록 카드는 그 자신이 details */
    var row = (t.closest && t.closest("tr")) || t;
    $$(".ds-hit").forEach(function (x) { x.classList.remove("ds-hit"); });
    if (!/^H[1-6]$/.test(row.tagName)) row.classList.add("ds-hit");
    if (scroll) row.scrollIntoView({ block: "start" });
    spy();
  }
  /* mermaid 그림: 사이트에 넣은 파일(assets/mermaid/mermaid.min.js, 버전 고정)을 그림이 있는 쪽에서만 읽는다. 오프라인 · file:// 에서도 된다.
     테마를 바꾸면 다시 그린다. 문법 오류면 그 그림 자리에 오류 문구와 원문을 보이고 나머지는 그대로 그린다 */
  var diagrams = $$("pre.mermaid");
  var mmLoad = null, mmSeq = 0;
  function loadMermaid() {
    if (window.mermaid) return Promise.resolve(window.mermaid);
    if (!mmLoad) mmLoad = new Promise(function (ok, no) {
      var s = document.createElement("script");
      s.src = ROOT + "assets/mermaid/mermaid.min.js";
      s.onload = function () { window.mermaid ? ok(window.mermaid) : no(new Error("mermaid 를 읽지 못했습니다")); };
      s.onerror = function () { no(new Error("assets/mermaid/mermaid.min.js 가 없습니다 (aikit docs build 로 다시 만든다)")); };
      document.head.appendChild(s);
    });
    return mmLoad;
  }
  function drawDiagrams() {
    if (!diagrams.length) return Promise.resolve();
    diagrams.forEach(function (n) { if (n.dataset.src == null) n.dataset.src = n.textContent; });
    return loadMermaid().then(function (m) {
      var dark = document.documentElement.dataset.theme === "dark";
      m.initialize({ startOnLoad: false, theme: dark ? "dark" : "default", securityLevel: "strict", suppressErrorRendering: true, flowchart: { htmlLabels: true } });
      var chain = Promise.resolve();
      diagrams.forEach(function (n) {
        chain = chain.then(function () {
          var id = "mm-" + (++mmSeq);
          return m.render(id, n.dataset.src).then(function (r) {
            n.innerHTML = r.svg; n.classList.remove("mm-bad"); n.closest(".diagram").classList.remove("bad");
          }, function (e) {
            var stray = document.getElementById("d" + id); if (stray) stray.remove();
            n.classList.add("mm-bad"); n.closest(".diagram").classList.add("bad");
            n.innerHTML = '<div class="mm-err">그림을 그리지 못했습니다: ' + esc(String((e && e.message) || e).split("\n").slice(0, 3).join(" ")) + "</div>" + esc(n.dataset.src);
          });
        });
      });
      return chain;
    }, function (e) {
      diagrams.forEach(function (n) { n.closest(".diagram").classList.add("bad"); n.innerHTML = '<div class="mm-err">' + esc(e.message) + "</div>" + esc(n.dataset.src); });
    });
  }
  var diagReady = drawDiagrams();

  /* 그림 확대(화면 위에 크게, 더하기 · 빼기 · 맞춤 · Esc 닫기) · 새 창 */
  function svgOf(btn) { var d = btn.closest(".diagram"); return d && !d.classList.contains("bad") ? $("pre.mermaid svg", d) : null; }
  function svgSize(svg) { var v = svg.viewBox && svg.viewBox.baseVal; return v && v.width ? { w: v.width, h: v.height } : { w: svg.getBoundingClientRect().width, h: svg.getBoundingClientRect().height }; }
  function zoom(svg) {
    var box = document.createElement("div"), size = svgSize(svg), k = 1;
    box.className = "mm-overlay";
    box.innerHTML = '<div class="mm-bar"><button type="button" data-z="in" title="크게">+</button><button type="button" data-z="out" title="작게">−</button><button type="button" data-z="fit" title="화면에 맞춤">맞춤</button><span class="mm-k"></span><button type="button" data-z="close" title="닫기 (Esc)">닫기</button></div><div class="mm-stage"></div>';
    var stage = $(".mm-stage", box), copy = svg.cloneNode(true);
    copy.removeAttribute("style"); copy.removeAttribute("width"); copy.removeAttribute("height");
    stage.appendChild(copy);
    function set(v) { k = Math.max(0.1, Math.min(8, v)); copy.style.width = size.w * k + "px"; copy.style.height = size.h * k + "px"; $(".mm-k", box).textContent = Math.round(k * 100) + "%"; }
    function fit() { set(Math.min((stage.clientWidth - 32) / size.w, (stage.clientHeight - 32) / size.h, 2)); }
    function close() { box.remove(); document.removeEventListener("keydown", key); }
    function key(e) { if (e.key === "Escape") close(); }
    box.addEventListener("click", function (e) {
      var z = e.target.dataset && e.target.dataset.z;
      if (z === "in") set(k * 1.25); else if (z === "out") set(k / 1.25); else if (z === "fit") fit(); else if (z === "close" || e.target === stage) close();
    });
    stage.addEventListener("wheel", function (e) { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); set(k * (e.deltaY < 0 ? 1.1 : 1 / 1.1)); }, { passive: false });
    document.addEventListener("keydown", key);
    document.body.appendChild(box);
    fit();
  }
  function openWindow(svg) {
    var w = window.open("", "_blank");
    if (!w) return;
    var dark = document.documentElement.dataset.theme === "dark";
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + esc(document.title) + ' · 그림</title><style>body{margin:0;padding:24px;background:' + (dark ? "#0d1117" : "#fff") + '}svg{max-width:none!important;height:auto}</style></head><body>' + svg.outerHTML + "</body></html>");
    w.document.close();
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("button.mm-zoom, button.mm-open");
    if (!b) return;
    var svg = svgOf(b);
    if (!svg) return;
    if (b.classList.contains("mm-zoom")) zoom(svg); else openWindow(svg);
  });

  /* 인쇄: 인쇄 단추 → 이 문서 · 전체 문서. 인쇄 때는 접힌 곳을 모두 편다 (Ctrl+P 도) */
  addEventListener("beforeprint", function () { $$("details").forEach(function (d) { d.open = true; }); });
  var pb = $("#print");
  if (pb) {
    var pm = document.createElement("div");
    pm.className = "print-menu"; pm.hidden = true;
    pm.innerHTML = '<button type="button" data-p="one">이 문서 인쇄</button><button type="button" data-p="all">전체 문서 인쇄</button>';
    pb.parentNode.appendChild(pm);
    pb.addEventListener("click", function (e) { e.stopPropagation(); pm.hidden = !pm.hidden; });
    document.addEventListener("click", function () { pm.hidden = true; });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") pm.hidden = true; });
    pm.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("button");
      if (!b) return;
      pm.hidden = true;
      if (b.getAttribute("data-p") === "all") { location.href = ROOT + "print-all.html"; return; }
      diagReady.then(function () { window.print(); });
    });
  }
  /* 전체 문서 인쇄 쪽(print-all.html): 검색 목록(메뉴 순서)의 문서를 모두 불러와 본문만 이어 붙이고 그림을 그린 뒤 인쇄 창을 연다 */
  var pa = document.getElementById("print-all");
  if (pa) (function () {
    var st = $(".print-status", pa), auto = pa.getAttribute("data-auto") !== "0";   /* docs-site.json printAll.autoPrint: false 면 다 불러온 뒤 안내만 */
    if (location.protocol === "file:") { st.textContent = "전체 인쇄는 웹 주소(Pages 등)로 열었을 때만 됩니다. 이 PC 파일로 보고 있으면 npx serve docs-site 처럼 웹 서버로 여세요. 이 문서 인쇄는 그대로 됩니다."; return; }
    var list = ((window.DS_SEARCH || {}).pages || []).map(function (p) { return p.u; }).filter(function (u, i, a) { return a.indexOf(u) === i && u !== "print-all.html"; });
    var out = [], next = 0, done = 0;
    function fix(root, base) {
      $$("[href],[src]", root).forEach(function (n) {
        ["href", "src"].forEach(function (k) {
          var v = n.getAttribute(k);
          if (v && !/^(#|[a-z][a-z0-9+.-]*:)/i.test(v)) { try { n.setAttribute(k, new URL(v, base).href); } catch (e) {} }
        });
      });
    }
    function one() {
      if (next >= list.length) return Promise.resolve();
      var i = next++, base = new URL(ROOT + list[i], location.href).href, sec = document.createElement("section");
      sec.className = "print-doc";
      out[i] = sec;
      return fetch(base).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }).then(function (h) {
        var d = new DOMParser().parseFromString(h, "text/html"), a = d.querySelector("article.page");
        if (!a) { sec.innerHTML = "<h1>" + esc(d.title) + '</h1><p class="ds-muted">이 문서는 따로 엽니다: <a href="' + esc(base) + '">' + esc(base) + "</a></p>"; return; }
        $$(".src", a).forEach(function (x) { x.remove(); });
        fix(a, base);
        sec.innerHTML = a.innerHTML;
      }, function () { sec.innerHTML = '<p class="mm-err">불러오지 못했습니다: ' + esc(list[i]) + "</p>"; }).then(function () {
        done++; st.textContent = "문서를 불러오는 중 " + done + " / " + list.length;
        return one();
      });
    }
    var workers = [];
    for (var w = 0; w < 6; w++) workers.push(one());
    Promise.all(workers).then(function () {
      out.forEach(function (s) { pa.appendChild(s); });
      st.textContent = auto ? list.length + "개 문서. 인쇄 창을 엽니다 (다시 열기: 위 인쇄 단추 → 이 문서 인쇄)" : list.length + "개 문서를 모두 불러왔습니다. 위 인쇄 단추 → 이 문서 인쇄 (또는 Ctrl+P · ⌘P)";
      diagrams = $$("pre.mermaid");
      return drawDiagrams();
    }).then(function () {
      diagReady = Promise.resolve();
      $$("details").forEach(function (d) { d.open = true; });
      if (auto) setTimeout(function () { window.print(); }, 300);
    });
  })();

  /* 펜 필기: 머리 줄 펜 단추로 켜고 끈다. 펜 · 형광펜 · 지우개(획 지우기, 범위 원), 도구마다 색 5 · 크기 4단계, 자(곧은 선), 되돌리기, 모두 지우기, PNG 받기.
     획은 본문(article) 기준 좌표로 이 기기에 쪽마다 저장하고(localStorage), SVG 층이라 인쇄에도 나온다.
     펜이 닿으면 손가락은 쓰지 않고, 두 손가락은 늘 화면 이동 (아래 「그리기 · 지우기 · 화면 이동」) */
  (function () {
    var btn = document.getElementById("ink"), page = $("article.page");
    if (!btn) return;
    if (!page || document.getElementById("print-all")) { btn.remove(); return; }
    var NS = "http://www.w3.org/2000/svg", root = document.documentElement;
    var KEY = "aikit-docs-ink:" + location.pathname, PREF = "aikit-docs-ink-prefs";
    var TOOLS = {
      pen: { colors: ["var(--fg)", "#cf222e", "#0969da", "#1a7f37", "#bf5af2"], sizes: [1.5, 2.5, 4, 7] },
      hl: { colors: ["#ffd60a", "#7ee08a", "#7cc4ff", "#ff9ec7", "#ffb35c"], sizes: [8, 14, 20, 28] },
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
    var svgI = function (k) { return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICO[k] + "</svg>"; };
    var load = function (k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
    var keep = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
    var pref = load(PREF, {});
    var tool = TOOLS[pref.tool] ? pref.tool : "pen", color = pref.color || {}, size = pref.size || {};
    var ruler = !!pref.ruler;   /* 자: 흔들려도 곧은 선 (마우스는 Shift 를 누른 동안도) */
    var strokes = load(KEY, []), hist = [];
    if (!Array.isArray(strokes)) strokes = [];

    var layer = document.createElementNS(NS, "svg");
    layer.setAttribute("class", "ink-layer");
    layer.setAttribute("aria-hidden", "true");
    page.appendChild(layer);
    var ring = document.createElement("div");
    ring.className = "ink-eraser";
    document.body.appendChild(ring);
    var bar = document.createElement("div");
    bar.className = "ink-bar";
    bar.setAttribute("role", "toolbar");
    bar.setAttribute("aria-label", "펜 필기 도구");
    document.body.appendChild(bar);

    var W = function () { return page.offsetWidth || 1; };
    var r1 = function (v) { return Math.round(v * 10) / 10; };
    function pathD(p) {
      if (p.length < 4) return "M" + p[0] + " " + p[1] + "l0.01 0";
      var d = "M" + p[0] + " " + p[1];
      for (var i = 2; i < p.length - 2; i += 2) d += " Q" + p[i] + " " + p[i + 1] + " " + r1((p[i] + p[i + 2]) / 2) + " " + r1((p[i + 1] + p[i + 3]) / 2);
      return d + " L" + p[p.length - 2] + " " + p[p.length - 1];
    }
    function el(s) {
      var e = document.createElementNS(NS, "path");
      e.setAttribute("d", pathD(s.d));
      if (s.t === "hl") { e.setAttribute("class", "hl"); e.style.strokeOpacity = ".55"; }
      e.style.stroke = s.c;
      e.style.strokeWidth = s.s;
      var k = W() / (s.w || W());
      if (Math.abs(k - 1) > 0.001) e.setAttribute("transform", "scale(" + k + ")");
      return e;
    }
    function render() {
      layer.setAttribute("width", W());
      layer.setAttribute("height", Math.max(page.scrollHeight, page.offsetHeight));
      while (layer.firstChild) layer.removeChild(layer.firstChild);
      strokes.forEach(function (s) { layer.appendChild(el(s)); });
      if (curEl) layer.appendChild(curEl);   /* 그리는 중인 획 */
    }
    function save() { if (strokes.length) keep(KEY, strokes); else { try { localStorage.removeItem(KEY); } catch (e) {} } paintBar(); }
    function snap() { hist.push(JSON.stringify(strokes)); if (hist.length > 50) hist.shift(); }

    function paintBar() {
      var t = TOOLS[tool], h = "";
      ["pen", "hl", "er"].forEach(function (k) { h += '<button type="button" data-tool="' + k + '" class="' + (k === tool ? "on" : "") + '" title="' + { pen: "펜", hl: "형광펜", er: "지우개" }[k] + '">' + svgI(k) + "</button>"; });
      if (t.colors) {
        h += '<span class="ink-sep"></span>';
        t.colors.forEach(function (c, i) { h += '<button type="button" class="ink-c' + (i === (color[tool] || 0) ? " on" : "") + '" data-color="' + i + '" title="색 ' + (i + 1) + '" style="--c:' + c + '"><i></i></button>'; });
      }
      h += '<span class="ink-sep"></span>';
      t.sizes.forEach(function (v, i) {
        var dot = Math.round(4 + i * 3.5);
        h += '<button type="button" class="ink-s' + (i === (size[tool] == null ? 1 : size[tool]) ? " on" : "") + '" data-size="' + i + '" title="크기 ' + (i + 1) + '"><i style="width:' + dot + "px;height:" + dot + 'px"></i></button>';
      });
      h += '<span class="ink-sep"></span>' +
        '<button type="button" data-act="ruler" class="' + (ruler ? "on" : "") + '" aria-pressed="' + ruler + '" title="자: 곧은 선 (가로 · 세로 · 45° 에 붙음. 마우스는 Shift 를 누른 동안도)">' + svgI("ruler") + "</button>" +
        '<button type="button" data-act="undo" title="되돌리기 (⌘Z · Ctrl+Z)"' + (hist.length ? "" : " disabled") + ">" + svgI("undo") + "</button>" +
        '<button type="button" data-act="clear" title="이 쪽 필기 모두 지우기 (되돌리기로 살린다)"' + (strokes.length ? "" : " disabled") + ">" + svgI("clear") + "</button>" +
        '<button type="button" data-act="png" title="필기 PNG 받기"' + (strokes.length ? "" : " disabled") + ">" + svgI("png") + "</button>" +
        '<button type="button" data-act="close" title="필기 끝내기 (Esc)">' + svgI("close") + "</button>";
      bar.innerHTML = h;
      root.classList.toggle("ink-erase", tool === "er");
    }
    var prefs = function () { keep(PREF, { tool: tool, color: color, size: size, ruler: ruler, pen: penSeen || undefined }); };
    bar.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("button");
      if (!b || b.disabled) return;
      if (b.dataset.tool) { tool = b.dataset.tool; prefs(); }
      else if (b.dataset.color) { color[tool] = +b.dataset.color; prefs(); }
      else if (b.dataset.size) { size[tool] = +b.dataset.size; prefs(); }
      else if (b.dataset.act === "ruler") { ruler = !ruler; prefs(); }
      else if (b.dataset.act === "undo") return undo();
      else if (b.dataset.act === "clear") { snap(); strokes = []; render(); save(); return; }
      else if (b.dataset.act === "png") return png();
      else if (b.dataset.act === "close") return setOn(false);
      paintBar();
    });
    function undo() { if (!hist.length) return; strokes = JSON.parse(hist.pop()); render(); save(); }

    var sizeOf = function () { var t = TOOLS[tool]; return t.sizes[size[tool] == null ? 1 : size[tool]]; };
    function setOn(on) {
      root.classList.toggle("ink-on", on);
      btn.setAttribute("aria-pressed", String(on));
      if (on) { render(); paintBar(); } else ring.classList.remove("on");
    }
    btn.addEventListener("click", function () { setOn(!root.classList.contains("ink-on")); });
    /* Esc = 필기 끝내기: 창의 잡기 단계에서 받아 다른 스크립트(이 repo 덧붙임 등)가 막아도 듣고, 옛 키 이름(Esc) · 키 코드 27 도 */
    window.addEventListener("keydown", function (e) {
      if (!root.classList.contains("ink-on")) return;
      if (e.key === "Escape" || e.key === "Esc" || e.keyCode === 27) { e.preventDefault(); setOn(false); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); }
      else if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
    }, true);

    /* 그리기 · 지우기 · 화면 이동 (필기를 켠 동안)
       펜(Apple Pencil · S Pen = pointerType pen, iPad 는 터치의 touchType stylus)이 닿은 적 있으면: 펜 = 필기, 손가락 = 브라우저 기본 스크롤, 확대는 막는다 (두 손가락 스크롤이 확대와 겹친다. 펜을 대고 있는 동안은 스크롤도 막는다. 손바닥은 OS 가 거른다)
       펜이 없으면: 한 손가락 = 필기, 두 손가락 = 화면 이동 (두 번째 손가락이 닿으면 첫 손가락이 긋던 획은 버린다). 마우스 = 필기.
       iPad Safari 는 SVG 의 touch-action 을 다 따르지 않아 막을 터치는 터치 이벤트에서 직접 막는다. 펜이 없을 때의 두 손가락 이동은 여기서 한다 */
    var cur = null, curEl = null, curId = null, curTouch = false, erased = false, penSeen = !!pref.pen;   /* 펜은 한 번 닿으면 이 기기에서 기억 */
    var fingers = {}, pan = null, vel = [0, 0], lastT = 0, fling = 0, glideAt = [0, 0];
    function markPen() { if (!penSeen) { penSeen = true; root.classList.add("ink-pen"); prefs(); } }
    if (penSeen) root.classList.add("ink-pen");
    var penDown = false;   /* 펜이 닿아 있는 동안 (Android 는 터치에 펜 표시가 없어 pointerdown 에서 안다) */
    function block(e) {
      if (!root.classList.contains("ink-on")) return;
      var stylus = false;
      for (var i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].touchType === "stylus") { stylus = true; markPen(); }
      if (penSeen && !stylus && !penDown) return;   /* 손가락은 브라우저에 맡긴다 */
      if (e.cancelable) e.preventDefault();
    }
    layer.addEventListener("touchstart", block, { passive: false });
    layer.addEventListener("touchmove", block, { passive: false });
    var nFingers = function () { return Object.keys(fingers).length; };
    function centroid() { var x = 0, y = 0, n = 0; for (var k in fingers) { x += fingers[k][0]; y += fingers[k][1]; n++; } return [x / n, y / n]; }
    function at(e) { var r = page.getBoundingClientRect(); return [r1(e.clientX - r.left), r1(e.clientY - r.top)]; }
    function segDist(px, py, ax, ay, bx, by) {
      var dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0;
      return Math.hypot(px - ax - t * dx, py - ay - t * dy);
    }
    function eraseAt(x, y) {
      var r = sizeOf(), w = W(), before = strokes.length;
      strokes = strokes.filter(function (s) {
        var k = w / (s.w || w), p = s.d, lim = r + (s.s * k) / 2;
        if (p.length < 4) return Math.hypot(x - p[0] * k, y - p[1] * k) > lim;
        for (var i = 0; i < p.length - 2; i += 2) if (segDist(x, y, p[i] * k, p[i + 1] * k, p[i + 2] * k, p[i + 3] * k) <= lim) return false;
        return true;
      });
      if (strokes.length !== before) { if (!erased) { hist.push(JSON.stringify(cur)); erased = true; } render(); }
    }
    var erLast = null;
    function eraseTo(x, y) {   /* 지우개가 지난 길 전체 (빠르게 움직여도 사이의 획을 놓치지 않는다) */
      if (erLast) { var dx = x - erLast[0], dy = y - erLast[1], n = Math.ceil(Math.hypot(dx, dy) / Math.max(2, sizeOf() / 2));
        for (var i = 1; i < n; i++) eraseAt(erLast[0] + dx * i / n, erLast[1] + dy * i / n); }
      eraseAt(x, y); erLast = [x, y];
    }
    function showRing(e) {
      if (tool !== "er") return;
      var d = sizeOf() * 2;
      ring.style.width = ring.style.height = d + "px";
      ring.style.left = e.clientX + "px"; ring.style.top = e.clientY + "px";
      ring.classList.add("on");
    }
    /* 자: 시작점에서 지금 점까지 곧은 선. 가로 · 세로 · 45° 근처(6° 안)면 그 각으로 붙인다 */
    function straight(p) {
      var x0 = cur.d[0], y0 = cur.d[1], dx = p[0] - x0, dy = p[1] - y0, len = Math.hypot(dx, dy);
      if (!len) return [x0, y0, p[0], p[1]];
      var ang = Math.atan2(dy, dx), step = Math.PI / 4, near = Math.round(ang / step) * step;
      if (Math.abs(ang - near) < Math.PI / 30) { dx = len * Math.cos(near); dy = len * Math.sin(near); }
      return [x0, y0, r1(x0 + dx), r1(y0 + dy)];
    }
    function start(e) {
      try { layer.setPointerCapture(e.pointerId); } catch (x) {}
      curId = e.pointerId; curTouch = e.pointerType === "touch";
      var p = at(e);
      if (tool === "er") { cur = strokes.slice(); erased = false; erLast = null; eraseTo(p[0], p[1]); showRing(e); return; }
      var t = TOOLS[tool];
      cur = { t: tool, c: t.colors[color[tool] || 0], s: sizeOf(), w: W(), d: p };
      curEl = el(cur);
      layer.appendChild(curEl);
    }
    function drop() {   /* 두 번째 손가락: 첫 손가락이 긋던 획 · 지우던 것을 되돌린다 */
      if (!cur) return;
      if (tool === "er") { if (erased) { strokes = cur; hist.pop(); render(); } }
      else if (curEl) curEl.remove();
      cur = null; curEl = null; curId = null; erased = false;
    }
    /* 스크롤은 손가락 · 펜 · 마우스가 있는 자리의 요소로: 필기 층 아래 요소에서 위로 올라가며 그 방향으로 더 움직일 수 있는 첫 스크롤 상자(넓은 표 · 코드 · 그림 · 메뉴), 없으면 창 */
    function under(x, y) {
      var list = document.elementsFromPoint ? document.elementsFromPoint(x, y) : [];
      for (var i = 0; i < list.length; i++) if (list[i] !== layer && !layer.contains(list[i])) return list[i];
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
    layer.addEventListener("wheel", function (e) {   /* 마우스 휠 · 트랙패드: 필기 층이 가리지 않게 그 자리 요소로 (확대 제스처는 그대로) */
      if (!root.classList.contains("ink-on") || e.ctrlKey) return;
      var k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1, dx = e.deltaX * k, dy = e.deltaY * k;
      if (e.shiftKey && !dx) { dx = dy; dy = 0; }
      e.preventDefault();
      scrollAt(e.clientX, e.clientY, dx, dy);
    }, { passive: false });
    function glide() {   /* 두 손가락을 뗀 뒤 조금 더 미끄러진다 (뗀 자리의 요소로) */
      cancelAnimationFrame(fling);
      var step = function () {
        vel = [vel[0] * 0.92, vel[1] * 0.92];
        if (Math.abs(vel[0]) < 0.02 && Math.abs(vel[1]) < 0.02) return;
        scrollAt(glideAt[0], glideAt[1], -vel[0] * 16, -vel[1] * 16);
        fling = requestAnimationFrame(step);
      };
      fling = requestAnimationFrame(step);
    }
    layer.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      cancelAnimationFrame(fling);   /* 새로 닿으면 미끄러지던 것을 멈춘다 */
      if (e.pointerType === "pen") { markPen(); penDown = true; if (!cur) start(e); return; }
      if (e.pointerType === "mouse") { if (e.button === 0 && !cur) start(e); return; }
      if (penSeen) return;   /* 손가락 = 브라우저 기본 스크롤 */
      fingers[e.pointerId] = [e.clientX, e.clientY];
      try { layer.setPointerCapture(e.pointerId); } catch (x) {}
      if (nFingers() >= 2) {
        if (cur && curTouch) drop();
        cancelAnimationFrame(fling); pan = centroid(); vel = [0, 0]; lastT = e.timeStamp;
        return;
      }
      if (!penSeen && !cur) start(e);
    });
    layer.addEventListener("pointermove", function (e) {
      if (e.pointerType === "touch" && fingers[e.pointerId]) {
        var o = fingers[e.pointerId], n = Math.min(2, nFingers());
        fingers[e.pointerId] = [e.clientX, e.clientY];
        if (pan && n >= 2) {
          /* 움직인 손가락 하나의 이동 / 2 = 두 손가락 가운데 점의 이동. 손가락(펜을 쥔 손바닥 등)이 닿고 떨어져도 튀지 않고, 가만있는 손바닥이 이동을 줄이지 않는다 */
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
      if (tool !== "er" && (ruler || e.shiftKey)) cur.d = straight(at(evs[evs.length - 1]));
      else evs.forEach(function (ev) {
        var p = at(ev);
        if (tool === "er") return eraseTo(p[0], p[1]);
        var d = cur.d, lx = d[d.length - 2], ly = d[d.length - 1];
        if (Math.hypot(p[0] - lx, p[1] - ly) >= 1.2) d.push(p[0], p[1]);
      });
      if (curEl) curEl.setAttribute("d", pathD(cur.d));
    });
    function end(e) {
      if (e.pointerType === "pen") penDown = false;
      if (e.pointerType === "touch" && fingers[e.pointerId]) {
        delete fingers[e.pointerId];
        if (pan && nFingers() < 2) { glideAt = pan; pan = null; if (e.timeStamp - lastT < 80) glide(); }
      }
      if (!cur || e.pointerId !== curId) return;
      if (tool === "er") { if (erased) save(); }
      else { snap(); strokes.push(cur); save(); }
      cur = null; curEl = null; curId = null; erased = false;
    }
    layer.addEventListener("pointerup", end);
    layer.addEventListener("pointercancel", end);
    layer.addEventListener("pointerleave", function () { ring.classList.remove("on"); });

    /* PNG: 필기 층만 본문 크기 그대로 (배경 = 지금 테마 색). 큰 쪽은 브라우저 한도 안으로 줄인다 */
    function png() {
      var w = W(), h = Math.max(page.scrollHeight, page.offsetHeight), cs = getComputedStyle(document.body);
      var k = Math.min(2, 16384 / w, 16384 / h, Math.sqrt(16e6 / (w * h)));
      var copy = layer.cloneNode(true), fg = getComputedStyle(root).getPropertyValue("--fg").trim() || "#1f2328";
      copy.setAttribute("xmlns", NS);
      copy.setAttribute("viewBox", "0 0 " + w + " " + h);
      copy.removeAttribute("class");
      Array.prototype.forEach.call(copy.querySelectorAll("path"), function (n) {
        n.setAttribute("fill", "none"); n.setAttribute("stroke-linecap", "round"); n.setAttribute("stroke-linejoin", "round");
        if (n.style.stroke.indexOf("var(") >= 0) n.style.stroke = fg;
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
          var h1 = $("h1", page);
          a.download = ((h1 && h1.textContent) || document.title).trim().replace(/[\\/:*?"<>|]+/g, " ").slice(0, 80) + " 필기.png";
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
        }, "image/png");
      };
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(copy));
    }

    /* 본문 크기가 바뀌면(창 크기 · 펼침 · 인쇄) 다시 그린다 */
    var again = function () { requestAnimationFrame(render); };
    if (window.ResizeObserver) new ResizeObserver(again).observe(page); else addEventListener("resize", again);
    addEventListener("beforeprint", render);
    addEventListener("afterprint", again);
    render();
  })();

  addEventListener("hashchange", function () { reveal(true); });
  if (location.hash) setTimeout(function () { reveal(true); }, 0);
})();
