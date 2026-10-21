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
