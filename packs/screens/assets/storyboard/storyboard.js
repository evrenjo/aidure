/* 화면설계서 뷰어(aikit screens 팩): 상단 고정 바(구분 · 장 선택 · 이전/다음 · 발표 · 인쇄) + 좌측 썸네일 목록.
 * 각 장: <section class="sheet" id="…" data-group="큰 구분" data-label="장 이름">
 * 키: ←/→ 이전·다음, F5 · F 발표(→ · Space · 클릭 다음, ← 이전, Esc 끝), I 내부 정보, Esc 근거 패널 닫기
 * 내부 정보(기본 보기 · 인쇄에서 숨김): Check Point(h3 + .check) · 근거 줄(.refs) · 마커별 근거 ID(.side ol.desc li 안의 ul) · class="sb-dev" 요소 */
(function () {
  "use strict";
  var sheets = Array.prototype.slice.call(document.querySelectorAll("section.sheet"));
  if (!sheets.length) return;
  var docTitle = document.body.getAttribute("data-doc") || document.title;

  sheets.forEach(function (s, i) {
    if (!s.id) s.id = "p" + (i + 1);
    if (!s.dataset.group) s.dataset.group = "기타";
    if (!s.dataset.label) s.dataset.label = s.id;
  });
  var groups = [];
  sheets.forEach(function (s) { if (groups.indexOf(s.dataset.group) < 0) groups.push(s.dataset.group); });

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  /* 골격: 상단 바 / (썸네일 | 본문) */
  var top = el("header", "sb-top");
  var title = el("div", "sb-title", docTitle);
  var gSel = el("select", "sb-sel"); gSel.setAttribute("aria-label", "구분");
  var pSel = el("select", "sb-sel sb-sel-page"); pSel.setAttribute("aria-label", "장");
  var prev = el("button", "sb-btn", "◀"); prev.title = "이전 장 (←)"; prev.setAttribute("aria-label", "이전 장");
  var count = el("span", "sb-count");
  var next = el("button", "sb-btn", "▶"); next.title = "다음 장 (→)"; next.setAttribute("aria-label", "다음 장");
  var zoomBtn = el("button", "sb-btn sb-zoom", "▶ 발표"); zoomBtn.title = "현재 장부터 화면 가득 한 장씩 보기 (F5 · F, 넘기기 → · Space · 클릭, 끝내기 Esc)";
  zoomBtn.setAttribute("aria-pressed", "false");
  var thumbBtn = el("button", "sb-btn sb-thumb-toggle", "☰"); thumbBtn.title = "미리보기 목록 열고 닫기";
  thumbBtn.setAttribute("aria-label", "미리보기 목록");
  var printBtn = el("button", "sb-btn sb-print", "인쇄"); printBtn.title = "A4 가로로 전체 장 인쇄 (⌘/Ctrl+P 와 같음)";
  printBtn.addEventListener("click", function () { window.print(); });
  var devBtn = el("button", "sb-btn sb-dev-btn", "내부 정보");
  devBtn.title = "개발자용 내부 정보 보이기 · 숨기기 (I): Check Point · 근거 줄 · 마커별 근거 ID · sb-dev. 켠 채 인쇄하면 함께 인쇄된다";
  devBtn.setAttribute("aria-pressed", "false");
  /* ← 문서: 문서 사이트로 돌아가기 (aikit docs build 가 data-back 에 화면설계 개요 쪽을 적는다. 없으면 사이트 메인) */
  var backHref = document.body.getAttribute("data-back") || (document.body.getAttribute("data-root") != null ? document.body.getAttribute("data-root") + "index.html" : null);
  var backBtn = null;
  if (backHref) { backBtn = el("a", "sb-btn sb-back", "← 문서"); backBtn.href = backHref; backBtn.title = "문서 사이트로 돌아가기"; }
  [thumbBtn, backBtn, title, gSel, pSel, prev, count, next, zoomBtn, devBtn, printBtn].forEach(function (x) { if (x) top.appendChild(x); });

  var layout = el("div", "sb-layout");
  var side = el("nav", "sb-thumbs"); side.setAttribute("aria-label", "장 미리보기");
  var main = el("main", "sb-main");
  sheets.forEach(function (s) { main.appendChild(s); });
  var oldToc = document.querySelector("nav.toc");
  if (oldToc) oldToc.remove();
  layout.appendChild(side); layout.appendChild(main);
  document.body.insertBefore(layout, document.body.firstChild);
  document.body.insertBefore(top, layout);
  document.body.classList.add("sb-on");

  /* 내부 정보: 클래스 없는 Check Point 제목도 바로 뒤 .check 를 보고 내부 정보로 (썸네일 복제 전에). 켠 상태는 브라우저에 기억한다 */
  sheets.forEach(function (s) {
    s.querySelectorAll("h3").forEach(function (h) { var n = h.nextElementSibling; if (n && n.classList.contains("check")) h.classList.add("sb-dev"); });
  });
  var DEV_KEY = "aikit.storyboard.dev";
  function devOn() { return document.body.classList.contains("sb-dev-on"); }
  function applyDev(on) { document.body.classList.toggle("sb-dev-on", on); devBtn.setAttribute("aria-pressed", String(on)); }
  try { applyDev(localStorage.getItem(DEV_KEY) === "1"); } catch (e) {}

  /* 썸네일: 장을 복제해 축소 */
  var THUMB_W = 196, SHEET_W = 1280;
  var thumbs = [];
  groups.forEach(function (g) {
    var box = el("details", "sb-group"); box.open = true;
    var sum = el("summary", null, g);
    box.appendChild(sum);
    sheets.forEach(function (s, i) {
      if (s.dataset.group !== g) return;
      var a = el("a", "sb-thumb"); a.href = "#" + s.id;
      var frame = el("div", "sb-frame");
      var clone = s.cloneNode(true);
      clone.removeAttribute("id");
      clone.querySelectorAll("[id]").forEach(function (n) { n.removeAttribute("id"); });
      clone.classList.add("sb-clone");
      clone.setAttribute("aria-hidden", "true");
      clone.style.transform = "scale(" + THUMB_W / SHEET_W + ")";
      frame.appendChild(clone);
      a.appendChild(frame);
      var cap = el("span", "sb-cap");
      cap.appendChild(el("b", null, String(i + 1)));
      cap.appendChild(document.createTextNode(" " + s.dataset.label));
      a.appendChild(cap);
      a.addEventListener("click", function (ev) { ev.preventDefault(); go(i); });
      box.appendChild(a);
      thumbs[i] = { a: a, group: box, frame: frame, clone: clone };
    });
    side.appendChild(box);
  });
  function sizeThumbs() {
    thumbs.forEach(function (t) {
      t.frame.style.height = Math.ceil(t.clone.offsetHeight * THUMB_W / SHEET_W) + "px";
    });
  }

  /* 선택 상자 */
  groups.forEach(function (g) { var o = el("option", null, g); o.value = g; gSel.appendChild(o); });
  function fillPages(g) {
    pSel.innerHTML = "";
    sheets.forEach(function (s, i) {
      if (s.dataset.group !== g) return;
      var o = el("option", null, (i + 1) + ". " + s.dataset.label); o.value = String(i); pSel.appendChild(o);
    });
  }
  gSel.addEventListener("change", function () {
    for (var i = 0; i < sheets.length; i++) if (sheets[i].dataset.group === gSel.value) { go(i); return; }
  });
  pSel.addEventListener("change", function () { go(parseInt(pSel.value, 10)); });

  /* 현재 장 */
  var cur = -1, lock = 0;
  function mark(i) {
    if (i === cur) return;
    cur = i;
    var s = sheets[i];
    sheets.forEach(function (x, k) { x.classList.toggle("sb-current", k === i); });
    thumbs.forEach(function (t, k) { t.a.classList.toggle("on", k === i); });
    if (gSel.value !== s.dataset.group) { gSel.value = s.dataset.group; fillPages(s.dataset.group); }
    pSel.value = String(i);
    count.textContent = (i + 1) + " / " + sheets.length;
    prev.disabled = i === 0; next.disabled = i === sheets.length - 1;
    var t = thumbs[i];
    if (t) {
      t.group.open = true;
      var r = t.a.getBoundingClientRect(), sr = side.getBoundingClientRect();
      if (r.top < sr.top || r.bottom > sr.bottom) t.a.scrollIntoView({ block: "nearest" });
    }
    if (history.replaceState) history.replaceState(null, "", "#" + s.id);
    fitPresent();
  }
  function go(i) {
    i = Math.max(0, Math.min(sheets.length - 1, i));
    lock = Date.now();
    mark(i);
    if (!presenting) sheets[i].scrollIntoView({ block: "start" });
  }
  prev.addEventListener("click", function () { go(cur - 1); });
  /* 켜고 끄는 동안 현재 장이 화면에서 같은 자리에 있게 한다 */
  function setDev(on) {
    var s = sheets[cur], y = s && !presenting ? s.getBoundingClientRect().top : null;
    clearPeek();
    applyDev(on);
    try { localStorage.setItem(DEV_KEY, on ? "1" : "0"); } catch (e) {}
    sizeThumbs();
    if (presenting) fitPresent();
    else if (y != null) { lock = Date.now(); window.scrollBy(0, s.getBoundingClientRect().top - y); }
  }
  devBtn.addEventListener("click", function () { setDev(!devOn()); });
  next.addEventListener("click", function () { go(cur + 1); });

  /* 스크롤로 현재 장 추적 */
  function onScroll() {
    if (presenting || Date.now() - lock < 600) return;
    var line = top.offsetHeight + 80, best = 0;
    for (var i = 0; i < sheets.length; i++) {
      if (sheets[i].getBoundingClientRect().top <= line) best = i; else break;
    }
    mark(best);
  }
  window.addEventListener("scroll", onScroll, { passive: true });

  /* 발표: PPT 슬라이드 쇼처럼 현재 장 하나를 화면 가득(비율 유지). 브라우저 전체 화면을 함께 켠다 */
  var root = document.documentElement, presenting = false;
  var fsReq = root.requestFullscreen || root.webkitRequestFullscreen;
  function fsEl() { return document.fullscreenElement || document.webkitFullscreenElement; }
  function fitPresent() {
    if (!presenting) return;
    var s = sheets[cur];
    sheets.forEach(function (x) { x.style.zoom = ""; });
    var k = Math.min(window.innerWidth / s.offsetWidth, window.innerHeight / s.offsetHeight);
    s.style.zoom = String(k);
  }
  function setPresent(on) {
    if (on === presenting) return;
    presenting = on;
    document.body.classList.toggle("sb-present", on);
    if (on) {
      if (panel && !panel.hidden) closePanel();
      if (fsReq && !fsEl()) { try { var pr = fsReq.call(root); if (pr && pr.catch) pr.catch(function () {}); } catch (e) {} }
      window.scrollTo(0, 0);
      fitPresent();
    } else {
      if (fsEl()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      sheets.forEach(function (x) { x.style.zoom = ""; });
      fitSheets();
      go(cur);
    }
  }
  function onFs() { if (!fsEl() && presenting) setPresent(false); else fitPresent(); }
  zoomBtn.addEventListener("click", function () { setPresent(true); });
  document.addEventListener("fullscreenchange", onFs);
  document.addEventListener("webkitfullscreenchange", onFs);
  window.addEventListener("resize", fitPresent);
  /* 발표 중 클릭: 링크가 아니면 다음 장 */
  main.addEventListener("click", function (e) {
    if (!presenting || (e.target.closest && e.target.closest("a, button, input, select"))) return;
    go(cur + 1);
  });

  document.addEventListener("keydown", function (e) {
    var t = e.target.tagName;
    if (t === "SELECT" || t === "INPUT" || t === "TEXTAREA" || e.target.isContentEditable || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === "KeyI" || e.key === "i" || e.key === "I") { setDev(!devOn()); e.preventDefault(); return; }
    if (e.key === "F5" || ((e.key === "f" || e.key === "F") && !presenting)) { setPresent(true); e.preventDefault(); return; }
    if (presenting && (e.key === " " || e.key === "Enter" || e.key === "ArrowDown")) { go(cur + 1); e.preventDefault(); return; }
    if (presenting && (e.key === "ArrowUp" || e.key === "Backspace")) { go(cur - 1); e.preventDefault(); return; }
    if (presenting && e.key === "Home") { go(0); e.preventDefault(); return; }
    if (presenting && e.key === "End") { go(sheets.length - 1); e.preventDefault(); return; }
    if (presenting && e.key === "Escape") { setPresent(false); return; }
    if (e.key === "ArrowRight" || e.key === "PageDown") { go(cur + 1); e.preventDefault(); }
    else if (e.key === "ArrowLeft" || e.key === "PageUp") { go(cur - 1); e.preventDefault(); }
    else if (e.key === "Escape" && panel && !panel.hidden) closePanel();
  });


  /* 근거 링크: ids.json(aikit docs build 의 색인)으로 본문의 ID · 문서 이름을 링크로 바꾸고, 누르면 오른쪽 패널에 연다.
   * <body data-root="../"> : 문서 사이트 루트까지의 상대 경로 (색인 = <root>assets/ids.json). aikit docs build 가 채운다
   * <section data-area="폴더"> 또는 <body data-area> : 여러 문서에 같은 번호가 있는 ID(문서마다 매기는 결정 번호)를 고를 기준 폴더
   * 링크하는 것: 색인에 있는 ID · 이 설계서 안 장의 id · 색인의 문서 이름(.md 생략 가능). 색인의 prefixes 머리말인데 정의가 없으면 빨간 물결 */
  var ROOT = document.body.getAttribute("data-root");
  var ID_SRC = "[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\\d+";
  var REF_RE = new RegExp("(" + ID_SRC + ")(?![\\w*-])", "g");
  var panel, frame, pTitle, pBack, pOpen, pList, stack = [];

  function buildPanel() {
    panel = el("aside", "sb-panel"); panel.setAttribute("aria-label", "근거 문서"); panel.hidden = true;
    var bar = el("div", "sb-panel-bar");
    pBack = el("button", "sb-btn", "◀"); pBack.title = "앞에 연 근거"; pBack.setAttribute("aria-label", "앞에 연 근거");
    pTitle = el("span", "sb-panel-title");
    pOpen = el("a", "sb-btn sb-panel-open", "새 탭"); pOpen.target = "_blank"; pOpen.rel = "noopener";
    var close = el("button", "sb-btn", "✕"); close.title = "닫기 (Esc)"; close.setAttribute("aria-label", "근거 패널 닫기");
    [pBack, pTitle, pOpen, close].forEach(function (x) { bar.appendChild(x); });
    pList = el("div", "sb-panel-list");
    frame = el("iframe", "sb-panel-frame"); frame.title = "근거 문서";
    panel.appendChild(bar); panel.appendChild(pList); panel.appendChild(frame);
    document.body.appendChild(panel);
    close.addEventListener("click", closePanel);
    pBack.addEventListener("click", function () { stack.pop(); var p = stack.pop(); if (p) openRef(p.label, p.hrefs); });
  }
  /* 패널이 열린 동안 장은 배치를 그대로 두고 남은 폭에 맞춰 축소한다 */
  /* 좁은 화면(860px 이하)도 같은 방식: 장을 다시 배치하지 않고 원래 배치 그대로 남은 폭에 맞춰 줄인다 (두 손가락으로 확대) */
  function fitSheets() {
    if (presenting) return;
    var on = (document.body.classList.contains("sb-panel-on") && window.innerWidth > 1000) || window.innerWidth <= 860;
    var cs = getComputedStyle(main);
    var avail = main.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    var k = on ? Math.min(1, avail / SHEET_W) : 1;
    sheets.forEach(function (s) {
      s.style.width = on ? SHEET_W + "px" : "";
      s.style.maxWidth = on ? "none" : "";
      s.style.zoom = on && k < 1 ? String(k) : "";
    });
  }
  window.addEventListener("resize", fitSheets);
  /* 인쇄: 한 장 = A4 가로 한 쪽(885px 높이를 0.83 배). 설명이 길어 885px 를 넘는 장은 잘리지 않게 더 줄인다 */
  var PRINT_H = 885, PRINT_ZOOM = 0.83;
  /* 장의 원래 높이(폭 1280px 기준). 화면 축소 · 패널과 상관없이 잰다 */
  function naturalH(s) {
    var keep = { w: s.style.width, mw: s.style.maxWidth, z: s.style.zoom };
    s.style.width = SHEET_W + "px"; s.style.maxWidth = "none"; s.style.zoom = "";
    var h = s.offsetHeight;
    s.style.width = keep.w; s.style.maxWidth = keep.mw; s.style.zoom = keep.z;
    return h;
  }
  function fitPrint() {
    sheets.forEach(function (s) {
      s.style.removeProperty("--print-h"); s.style.removeProperty("--print-zoom");
      var h = naturalH(s);
      if (h <= PRINT_H) return;
      s.style.setProperty("--print-h", h + "px");
      s.style.setProperty("--print-zoom", String(Math.floor(PRINT_ZOOM * PRINT_H / h * 1000) / 1000));
    });
  }
  /* 넘침 표시: 한 쪽을 넘는 장은 위에 띠 · 썸네일에 ⚠ (화면에서만, 인쇄 · 발표에는 안 나온다). 내용을 줄이거나 장을 나누라는 신호.
   * 내부 정보를 켜 두어도 기본 보기(내부 정보 제외 = 기본 인쇄) 높이로 잰다 */
  var OVER_TIP = "기본 보기(내부 정보 제외, 인쇄 기준) 높이로 잼";
  function markOver() {
    if (presenting) return;
    var dev = devOn();
    if (dev) document.body.classList.remove("sb-dev-on");
    var hs = sheets.map(naturalH);
    if (dev) document.body.classList.add("sb-dev-on");
    sheets.forEach(function (s, i) {
      var h = hs[i], over = h > PRINT_H;
      var badge = s.querySelector(":scope > .sb-over-badge");
      s.classList.toggle("sb-over", over);
      if (thumbs[i]) { thumbs[i].a.classList.toggle("sb-over", over); thumbs[i].a.title = over ? "한 쪽 넘침 (" + OVER_TIP + ")" : ""; }
      if (!over) { if (badge) badge.remove(); return; }
      if (!badge) { badge = el("div", "sb-over-badge"); badge.title = OVER_TIP + ". 내부 정보를 켜고 인쇄하면 더 줄어든다"; s.appendChild(badge); }
      badge.textContent = "⚠ 한 쪽 넘침 (" + (h - PRINT_H) + "px): 인쇄하면 다른 장의 " + Math.round(PRINT_H / h * 100) + "% 크기로 줄어듦. 설명을 줄이거나 장을 나누세요";
    });
  }
  /* 인쇄는 지금 보이는 대로: 내부 정보를 켰으면 포함하고, 그만큼 길어진 장을 줄인다 */
  window.addEventListener("beforeprint", function () { clearPeek(); fitPrint(); });

  /* 마커 호버(마우스 기기만): Description 줄이나 와이어프레임 마커(.mk)에 올리면 그 줄 · 마커를 강조하고 그 줄의 근거 ID 를 잠깐 보인다 */
  var peek = [];
  function clearPeek() { peek.forEach(function (n) { n.classList.remove("sb-peek", "sb-hl", "sb-peeking"); }); peek = []; }
  function peekAt(target) {
    var li = target.closest && target.closest(".side ol.desc > li"), sheet = target.closest && target.closest(".sheet");
    var mk = !li && target.closest && target.closest(".mk");
    if (!sheet || (!li && (!mk || mk.closest(".side")))) return clearPeek();
    var ol = sheet.querySelector(".side ol.desc");
    if (!ol) return clearPeek();
    if (!li) li = ol.children[parseInt(mk.textContent, 10) - 1];
    if (!li) return clearPeek();
    if (peek[0] === li) return;
    clearPeek();
    var no = Array.prototype.indexOf.call(ol.children, li) + 1;
    li.classList.add("sb-peek", "sb-hl"); peek.push(li);
    sheet.classList.add("sb-peeking"); peek.push(sheet);
    sheet.querySelectorAll(".mk").forEach(function (m) {
      if (!m.closest(".side") && parseInt(m.textContent, 10) === no) { m.classList.add("sb-hl"); peek.push(m); }
    });
  }
  if (window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    main.addEventListener("mouseover", function (e) { peekAt(e.target); });
    main.addEventListener("mouseleave", clearPeek);
  }
  function closePanel() { panel.hidden = true; document.body.classList.remove("sb-panel-on"); stack = []; frame.src = "about:blank"; fitSheets(); if (cur >= 0) go(cur); }
  function openRef(label, hrefs) {
    if (!panel) buildPanel();
    stack.push({ label: label, hrefs: hrefs });
    pBack.disabled = stack.length < 2;
    pTitle.textContent = label;
    pList.innerHTML = "";
    if (hrefs.length > 1) {
      pList.appendChild(el("span", null, "여러 문서에 있음:"));
      hrefs.forEach(function (h, k) {
        var b = el("button", "sb-chip" + (k === 0 ? " on" : ""), h.split("#")[0].replace(/\/index\.html$/, "").replace(/^.*?([^/]+\/[^/]+|[^/]+)$/, "$1"));
        b.addEventListener("click", function () {
          pList.querySelectorAll(".sb-chip").forEach(function (c) { c.classList.remove("on"); });
          b.classList.add("on"); show(h);
        });
        pList.appendChild(b);
      });
    }
    show(hrefs[0]);
    var wasOn = !panel.hidden;
    panel.hidden = false; document.body.classList.add("sb-panel-on");
    if (!wasOn) { fitSheets(); if (cur >= 0) go(cur); }
  }
  function show(h) {
    pOpen.href = h;
    if (/\.md(#|$)/i.test(h)) { showMd(h); return; }
    if (mdBox) mdBox.hidden = true;
    frame.hidden = false; frame.src = h;
  }

  function linkify(index) {
    var prefixes = index.prefixes || [];
    /* 문서 이름: 색인 docs 의 파일 이름 중 - 가 든 것(00-overview · 50-screen-policy). .md 를 붙여 써도 된다 */
    var names = Object.keys(index.docs).map(function (k) { return k.split("/").pop().replace(/\.md$/i, ""); })
      .filter(function (n, i, a) { return /-/.test(n) && a.indexOf(n) === i; })
      .sort(function (a, b) { return b.length - a.length; });
    var esc = function (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); };
    /* 번호로 시작하는 문서 이름은 앞부분만 써도 된다(20-requirements-05 → 20-requirements-05-api.md, 하나로 좁혀질 때) */
    REF_RE = new RegExp("(" + ID_SRC + "|\\d+-[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\\.md)?" + (names.length ? "|(?:" + names.map(esc).join("|") + ")(?:\\.md)?" : "") + ")(?![\\w*-])", "g");
    function resolve(tok, sheet) {
      var s = document.getElementById(tok);
      if (s && s.classList.contains("sheet")) return { inner: tok };
      var list = index.ids[tok];
      if (!list || !list.length) {
        var name = tok.replace(/\.md$/i, ""), hit = [];
        Object.keys(index.docs).forEach(function (md) {
          var base = md.split("/").pop().replace(/\.md$/i, "");
          if ((base === name || base.indexOf(name + "-") === 0) && hit.indexOf(index.docs[md]) < 0) hit.push(index.docs[md]);
        });
        if (hit.length === 1) return { hrefs: [ROOT + hit[0]] };
        if (prefixes.some(function (p) { return tok.indexOf(p + "-") === 0; })) return { broken: true };
        return null;
      }
      var area = (sheet && sheet.dataset.area) || document.body.getAttribute("data-area");
      if (list.length > 1 && area) {
        /* 영역 이름이 경로의 폴더나 파일 이름 조각이면(design/ui-ops/ · 30-design-ui-ops.html) 그 문서를 먼저 */
        var ar = new RegExp("(^|[/-])" + area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([/.-]|$)");
        var pref = list.filter(function (h) { return ar.test(h.split("#")[0]); });
        if (pref.length) list = pref.concat(list.filter(function (h) { return pref.indexOf(h) < 0; }));
      }
      return { hrefs: list.map(function (h) { return ROOT + h; }) };
    }
    sheets.forEach(function (sheet) {
      var walker = document.createTreeWalker(sheet, NodeFilter.SHOW_TEXT, {
        acceptNode: function (n) {
          return n.parentNode.closest("a, script, style, .sb-noref") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
        }
      });
      var nodes = [];
      var probe = new RegExp(REF_RE.source);
      while (walker.nextNode()) if (probe.test(walker.currentNode.nodeValue)) nodes.push(walker.currentNode);
      nodes.forEach(function (n) {
        var text = n.nodeValue, frag = document.createDocumentFragment(), last = 0, m;
        REF_RE.lastIndex = 0;
        while ((m = REF_RE.exec(text))) {
          if (m.index > 0 && /[\w-]/.test(text[m.index - 1])) continue;
          var r = resolve(m[1], sheet);
          if (!r) continue;
          frag.appendChild(document.createTextNode(text.slice(last, m.index)));
          if (r.broken) {
            var bad = el("span", "sb-broken", m[1]); bad.title = "색인에 정의가 없는 ID";
            frag.appendChild(bad); last = m.index + m[1].length; REF_RE.lastIndex = last; continue;
          }
          var a = el("a", "sb-ref", m[1]);
          if (r.inner) { a.href = "#" + r.inner; a.dataset.inner = r.inner; }
          else { a.href = r.hrefs[0]; a.dataset.hrefs = JSON.stringify(r.hrefs); a.title = "근거 보기 (⌘/Ctrl+클릭: 새 탭)"; }
          frag.appendChild(a);
          last = m.index + m[1].length;
          /* 줄여 쓴 이어지는 번호: 「VS-ADM-04 · 05 · 07」 의 05 · 07 도 VS-ADM-05 · VS-ADM-07 로 잇는다 */
          var pm = /^([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-)(\d+)$/.exec(m[1]), cm;
          var CONT = /^(\s*[·,]\s*)(\d{2,3})(?![\w-])/;
          while (pm && (cm = CONT.exec(text.slice(last))) && cm[2].length === pm[2].length) {
            var full = pm[1] + cm[2], rr = resolve(full, sheet);
            if (!rr || !rr.hrefs) break;
            frag.appendChild(document.createTextNode(cm[1]));
            var a2 = el("a", "sb-ref", cm[2]);
            a2.href = rr.hrefs[0]; a2.dataset.hrefs = JSON.stringify(rr.hrefs); a2.dataset.label = full;
            a2.title = full + " 보기 (⌘/Ctrl+클릭: 새 탭)";
            frag.appendChild(a2);
            last += cm[0].length;
          }
          REF_RE.lastIndex = last;
        }
        if (!last) return;
        frag.appendChild(document.createTextNode(text.slice(last)));
        n.parentNode.replaceChild(frag, n);
      });
    });
  }
  document.addEventListener("click", function (e) {
    var md = e.target.closest && e.target.closest(".sheet a[href$='.md'], .sheet a[href*='.md#']");
    if (md && !md.classList.contains("sb-ref") && !(e.metaKey || e.ctrlKey || e.shiftKey)) {
      e.preventDefault(); openRef(md.textContent, [md.getAttribute("href")]); return;
    }
    var a = e.target.closest && e.target.closest("a.sb-ref");
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    if (a.dataset.inner) { for (var i = 0; i < sheets.length; i++) if (sheets[i].id === a.dataset.inner) go(i); return; }
    if (presenting) setPresent(false);  /* 발표 중 근거를 누르면 발표를 끝내고 패널로 */
    openRef(a.dataset.label || a.textContent, JSON.parse(a.dataset.hrefs));
  });
  if (ROOT != null && window.fetch) {
    fetch(ROOT + "assets/ids.json").then(function (r) { return r.ok ? r.json() : null; })
      .then(function (index) { if (index) linkify(index); })
      .catch(function () { /* 색인을 못 읽으면 글자 그대로 둔다 */ });
  }


  /* ── md 보기: 링크가 .md 원문이면 받아서 문서 모양으로 그린다 (외부 라이브러리 없음) ── */
  function escH(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  /* md 안 링크 주소: http(s) 와 이 페이지와 같은 방식(상대 경로)만. javascript: 등은 버린다 */
  function safeUrl(u, base) {
    try { var x = new URL(u.replace(/&amp;/g, "&"), base); return /^https?:$/.test(x.protocol) || x.protocol === location.protocol ? escH(x.href) : null; } catch (e) { return null; }
  }
  function slug(t) { return t.trim().toLowerCase().replace(/[^\w가-힣\s-]/g, "").replace(/\s+/g, "-"); }
  function mdInline(t, base) {
    var codes = [];
    t = t.replace(/`([^`]+)`/g, function (_, c) { codes.push(c); return "\u0000" + (codes.length - 1) + "\u0000"; });
    t = escH(t)
      .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function (_, a, u) { var h = safeUrl(u, base); return h ? '<img alt="' + a + '" src="' + h + '">' : a; })
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, a, u) { var h = safeUrl(u, base); return h ? '<a href="' + h + '">' + a + "</a>" : a; })
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/~~(.+?)~~/g, "<del>$1</del>")
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
    return t.replace(/\u0000(\d+)\u0000/g, function (_, k) { return "<code>" + escH(codes[+k]) + "</code>"; });
  }
  function mdRender(src, base) {
    var lines = src.replace(/\r\n?/g, "\n").split("\n"), out = [], i = 0;
    function cells(l) { return l.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map(function (c) { return c.trim(); }); }
    while (i < lines.length) {
      var l = lines[i], m;
      if (/^```/.test(l)) {
        var buf = []; i++;
        while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
        i++; out.push("<pre><code>" + escH(buf.join("\n")) + "</code></pre>"); continue;
      }
      if ((m = /^(#{1,6})\s+(.*)$/.exec(l))) {
        var n = m[1].length, txt = m[2].replace(/\s+#+\s*$/, "");
        out.push("<h" + n + ' id="' + slug(txt) + '">' + mdInline(txt, base) + "</h" + n + ">"); i++; continue;
      }
      if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) { out.push("<hr>"); i++; continue; }
      if (/^\|/.test(l) && i + 1 < lines.length && /^\|?\s*:?-{2,}/.test(lines[i + 1])) {
        var head = cells(l); i += 2;
        var rows = [];
        while (i < lines.length && /^\|/.test(lines[i])) rows.push(cells(lines[i++]));
        out.push('<div class="md-table"><table><thead><tr>' + head.map(function (c) { return "<th>" + mdInline(c, base) + "</th>"; }).join("") +
          "</tr></thead><tbody>" + rows.map(function (r) {
            return "<tr>" + r.map(function (c) { return "<td>" + mdInline(c, base) + "</td>"; }).join("") + "</tr>";
          }).join("") + "</tbody></table></div>");
        continue;
      }
      if (/^>\s?/.test(l)) {
        var q = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ""));
        out.push("<blockquote>" + mdRender(q.join("\n"), base) + "</blockquote>"); continue;
      }
      if (/^\s*([-*+]|\d+\.)\s+/.test(l)) {
        var ordered = /^\s*\d+\./.test(l), items = [];
        while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
          var it = lines[i].replace(/^\s*([-*+]|\d+\.)\s+/, ""), ind = /^\s*/.exec(lines[i])[0].length;
          var task = /^\[( |x)\]\s+/i.exec(it);
          if (task) it = '<input type="checkbox" disabled' + (task[1] !== " " ? " checked" : "") + "> " + mdInline(it.slice(task[0].length), base);
          else it = mdInline(it, base);
          items.push('<li style="margin-left:' + ind * 8 + 'px">' + it + "</li>"); i++;
        }
        out.push((ordered ? "<ol>" : "<ul>") + items.join("") + (ordered ? "</ol>" : "</ul>")); continue;
      }
      if (!l.trim()) { i++; continue; }
      var para = [];
      while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|\||>|\s*([-*+]|\d+\.)\s)/.test(lines[i])) para.push(lines[i++]);
      out.push("<p>" + mdInline(para.join(" "), base) + "</p>");
    }
    return out.join("\n");
  }
  var mdBox;
  function showMd(url) {
    if (!mdBox) { mdBox = el("article", "sb-md"); panel.insertBefore(mdBox, frame); }
    frame.hidden = true; mdBox.hidden = false; mdBox.innerHTML = '<p class="sb-md-msg">불러오는 중…</p>';
    var u = new URL(url, location.href), hash = decodeURIComponent(u.hash.slice(1)); u.hash = "";
    fetch(u.href).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (t) {
        mdBox.innerHTML = '<div class="sb-md-file">' + escH(u.pathname.split("/").pop()) + "</div>" + mdRender(t, u.href);
        mdBox.scrollTop = 0;
        if (hash) {
          var target = mdBox.querySelector('[id="' + slug(hash).replace(/"/g, "") + '"]');
          if (!target) {   /* ID(예: FN-ADM-001)가 들어 있는 첫 제목 · 표 행 */
            var all = mdBox.querySelectorAll("h1,h2,h3,h4,h5,h6,tr");
            for (var k = 0; k < all.length && !target; k++) if (all[k].textContent.indexOf(hash) >= 0) target = all[k];
          }
          if (target) { target.scrollIntoView({ block: "start" }); target.classList.add("sb-md-hit"); }
        }
      })
      .catch(function (e) { mdBox.innerHTML = '<p class="sb-md-msg">문서를 열 수 없습니다 (' + escH(String(e.message || e)) + ")</p>"; });
  }

  /* 시작 장: 주소의 #id */
  var start = 0;
  if (location.hash) {
    var id = decodeURIComponent(location.hash.slice(1));
    sheets.forEach(function (s, i) { if (s.id === id) start = i; });
  }
  fillPages(sheets[start].dataset.group);
  fitSheets();
  sizeThumbs();
  markOver();
  window.addEventListener("load", function () { sizeThumbs(); markOver(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(markOver);
  go(start);
})();
