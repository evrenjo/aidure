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
