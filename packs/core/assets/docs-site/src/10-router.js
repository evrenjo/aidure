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
