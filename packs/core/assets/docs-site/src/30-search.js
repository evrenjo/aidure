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
