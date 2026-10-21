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
