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
      try { localStorage.setItem("kedovi-docs-theme", theme); } catch (e) { /* 저장 못 함 */ }
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
