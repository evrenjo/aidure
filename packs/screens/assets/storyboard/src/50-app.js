/* 뷰어 앱: 상단 바 · 썸네일 · 근거 패널 · 발표. 장은 앱이 만든 본문(.sb-main)으로 옮겨 그대로 두고, 현재 장 · 패널 · 발표 상태만 앱이 쥔다 */
(function () {
  'use strict';
  const SB = window.SB;
  const sheets = SB.sheets;
  if (!sheets || !sheets.length || !window.preact) return;
  const html = window.htm.bind(window.preact.h), H = window.preactHooks;
  const root = document.documentElement;
  const DEV_KEY = 'aidure.storyboard.dev', THUMB_KEY = 'aidure.storyboard.thumbs';
  const load = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const keep = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* 기억 못 해도 바뀐다 */ } };
  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
  const short = (h) => h.split('#')[0].replace(/\/index\.html$/, '').replace(/^.*?([^/]+\/[^/]+|[^/]+)$/, '$1');

  /** 썸네일 하나: 장을 복제해 줄인다 (id 는 지운다) */
  function Thumb(props) {
    const frame = H.useRef(null);
    H.useLayoutEffect(() => {
      const s = sheets[props.i];
      const clone = s.cloneNode(true);
      clone.removeAttribute('id');
      clone.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
      clone.querySelectorAll('.sb-over-badge').forEach((n) => n.remove());
      clone.classList.add('sb-clone');
      clone.setAttribute('aria-hidden', 'true');
      clone.style.transform = `scale(${SB.THUMB_W / SB.SHEET_W})`;
      frame.current.appendChild(clone);
      return () => clone.remove();
    }, []);
    H.useLayoutEffect(() => {   /* 높이: 내부 정보를 켜고 끄면 장 높이가 바뀐다 */
      const c = frame.current.firstChild;
      if (c && c.offsetHeight) frame.current.style.height = `${Math.ceil(c.offsetHeight * SB.THUMB_W / SB.SHEET_W)}px`;   /* 숨은 동안(근거 패널 · 목록 닫힘)은 재지 않는다 */
    });
    const s = sheets[props.i];
    return html`<a class=${`sb-thumb${props.on ? ' on' : ''}${props.over ? ' sb-over' : ''}`} href=${`#${s.id}`} title=${props.over ? `한 쪽 넘침 (${SB.OVER_TIP})` : ''}
      onClick=${(e) => { e.preventDefault(); props.go(props.i); }}><div class="sb-frame" ref=${frame}></div><span class="sb-cap"><b>${props.i + 1}</b> ${s.dataset.label}</span></a>`;
  }

  /** 근거 패널: ◀ 앞에 연 근거 · 새 탭 · 닫기. 여러 문서에 있으면 칩으로 고른다. .md 원문은 받아서 그린다 */
  function Panel(props) {
    const top = props.stack[props.stack.length - 1];
    const md = H.useState(null);
    const box = H.useRef(null);
    const h = top ? top.hrefs[top.i] : null;
    const isMd = !!h && /\.md(#|$)/i.test(h);
    H.useEffect(() => {
      if (!isMd) return;
      const u = new URL(h, location.href), hash = decodeURIComponent(u.hash.slice(1));
      u.hash = '';
      md[1]({ html: '<p class="sb-md-msg">불러오는 중…</p>' });
      let alive = true;
      fetch(u.href).then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); })
        .then((t) => { if (alive) md[1]({ html: `<div class="sb-md-file">${SB.esc(u.pathname.split('/').pop())}</div>${SB.mdRender(t, u.href)}`, hash }); })
        .catch((e) => { if (alive) md[1]({ html: `<p class="sb-md-msg">문서를 열 수 없습니다 (${SB.esc(String(e.message || e))})</p>` }); });
      return () => { alive = false; };
    }, [h]);
    H.useLayoutEffect(() => {   /* md 안 #ID: 그 제목 · 표 행으로 */
      const b = box.current, v = md[0];
      if (!b || !v || !v.hash) return;
      b.scrollTop = 0;
      let target = b.querySelector(`[id="${SB.slug(v.hash).replace(/"/g, '')}"]`);
      if (!target) for (const n of b.querySelectorAll('h1,h2,h3,h4,h5,h6,tr')) if (n.textContent.indexOf(v.hash) >= 0) { target = n; break; }
      if (target) { target.scrollIntoView({ block: 'start' }); target.classList.add('sb-md-hit'); }
    }, [md[0]]);
    if (!top) return html`<aside class="sb-panel" hidden></aside>`;
    return html`<aside class="sb-panel" aria-label="근거 문서">
      <div class="sb-panel-bar">
        <button class="sb-btn" title="앞에 연 근거" aria-label="앞에 연 근거" disabled=${props.stack.length < 2} onClick=${props.back}>◀</button>
        <span class="sb-panel-title">${top.label}</span>
        <a class="sb-btn sb-panel-open" target="_blank" rel="noopener" href=${h}>새 탭</a>
        <button class="sb-btn" title="닫기 (Esc)" aria-label="근거 패널 닫기" onClick=${props.close}>✕</button>
      </div>
      <div class="sb-panel-list">${top.hrefs.length > 1 ? html`<span>여러 문서에 있음:</span>${top.hrefs.map((x, k) => html`<button class=${`sb-chip${k === top.i ? ' on' : ''}`} onClick=${() => props.pick(k)}>${short(x)}</button>`)}` : null}</div>
      ${isMd ? html`<article class="sb-md" ref=${box} dangerouslySetInnerHTML=${{ __html: (md[0] || {}).html || '' }}></article>` : html`<iframe class="sb-panel-frame" title="근거 문서" src=${h}></iframe>`}
    </aside>`;
  }

  function App() {
    const start = H.useMemo(() => { let s = 0; try { const id = decodeURIComponent(location.hash.slice(1)); sheets.forEach((x, i) => { if (x.id === id) s = i; }); } catch (e) { /* 잘못된 주소 */ } return s; }, []);
    const cs = H.useState(start), cur = cs[0], setCur = cs[1];
    const ds = H.useState(() => load(DEV_KEY) === '1'), dev = ds[0], setDevS = ds[1];
    const ps = H.useState(false), presenting = ps[0], setPresenting = ps[1];
    const ss = H.useState([]), stack = ss[0], setStack = ss[1];
    const ts = H.useState(() => load(THUMB_KEY) !== 'off'), thumbsOn = ts[0], setThumbs = ts[1];
    const os = H.useState([]), over = os[0], setOver = os[1];
    const main = H.useRef(null), side = H.useRef(null);
    const live = H.useRef({});
    const lock = H.useRef(0);
    live.current = { cur, presenting, stack, dev };
    const panelOn = stack.length > 0;

    /* 장을 앱 본문으로 옮기고, 크기 · 넘침 · 근거 링크 (처음 한 번) */
    H.useLayoutEffect(() => {
      sheets.forEach((s) => main.current.appendChild(s));
      const old = document.querySelector('nav.toc');
      if (old) old.remove();
      document.body.classList.add('sb-on');
      const measure = () => setOver(SB.markOver());
      measure();
      window.addEventListener('load', measure);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
      SB.linkRefs();
      go(start);
    }, []);
    const go = (i) => {
      i = Math.max(0, Math.min(sheets.length - 1, i));
      lock.current = Date.now();
      setCur(i);
      if (!live.current.presenting) sheets[i].scrollIntoView({ block: 'start' });
    };
    /* 현재 장: 표시 · 주소 · 썸네일이 보이게 · 발표 맞춤 */
    H.useLayoutEffect(() => {
      sheets.forEach((x, k) => x.classList.toggle('sb-current', k === cur));
      if (history.replaceState) history.replaceState(null, '', `#${sheets[cur].id}`);
      const a = side.current && side.current.querySelector('.sb-thumb.on');
      if (a) { const d = a.closest('details'); if (d) d.open = true; const r = a.getBoundingClientRect(), sr = side.current.getBoundingClientRect(); if (r.top < sr.top || r.bottom > sr.bottom) a.scrollIntoView({ block: 'nearest' }); }
      if (presenting) SB.fitPresent(cur);
    }, [cur, presenting]);
    /* 내부 정보: 켜고 끄는 동안 현재 장이 화면에서 같은 자리에 있게 한다 */
    const setDev = (on) => {
      const s = sheets[live.current.cur], y = s && !live.current.presenting ? s.getBoundingClientRect().top : null;
      SB.clearPeek();
      document.body.classList.toggle('sb-dev-on', on);
      keep(DEV_KEY, on ? '1' : '0');
      setDevS(on);
      if (live.current.presenting) SB.fitPresent(live.current.cur);
      else if (y != null) { lock.current = Date.now(); window.scrollBy(0, s.getBoundingClientRect().top - y); }
    };
    H.useLayoutEffect(() => { document.body.classList.toggle('sb-dev-on', dev); }, []);
    H.useLayoutEffect(() => { document.body.classList.toggle('sb-thumbs-off', !thumbsOn); }, [thumbsOn]);
    /* 근거 패널이 열린 동안 장은 배치를 그대로 두고 남은 폭에 맞춰 줄인다 */
    H.useLayoutEffect(() => {
      document.body.classList.toggle('sb-panel-on', panelOn);
      SB.fitSheets(main.current, panelOn, presenting);
      const f = () => SB.fitSheets(main.current, live.current.stack.length > 0, live.current.presenting);
      window.addEventListener('resize', f);
      return () => window.removeEventListener('resize', f);
    }, [panelOn, presenting]);
    H.useEffect(() => { if (panelOn) go(live.current.cur); }, [panelOn]);
    const openRef = (label, hrefs) => { if (live.current.presenting) setPresent(false); setStack((s) => [...s, { label, hrefs, i: 0 }]); };
    const closePanel = () => { setStack([]); };
    /* 발표: PPT 슬라이드 쇼처럼 현재 장 하나를 화면 가득(비율 유지). 브라우저 전체 화면을 함께 켠다 */
    const setPresent = (on) => {
      if (on === live.current.presenting) return;
      setPresenting(on);
      document.body.classList.toggle('sb-present', on);
      if (on) {
        setStack([]);
        const req = root.requestFullscreen || root.webkitRequestFullscreen;
        if (req && !fsEl()) { try { const pr = req.call(root); if (pr && pr.catch) pr.catch(() => {}); } catch (e) { /* 막힘 */ } }
        window.scrollTo(0, 0);
      } else {
        if (fsEl()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        sheets.forEach((x) => { x.style.zoom = ''; });
        setTimeout(() => go(live.current.cur), 0);
      }
    };
    const actions = H.useRef({});
    actions.current = { go, setDev, setPresent, openRef, closePanel };

    H.useEffect(() => {
      const A = () => actions.current, L = () => live.current;
      /* 스크롤로 현재 장 추적 */
      const scroll = () => {
        if (L().presenting || Date.now() - lock.current < 600) return;
        const line = (document.querySelector('.sb-top') || { offsetHeight: 48 }).offsetHeight + 80;
        let best = 0;
        for (let i = 0; i < sheets.length; i++) { if (sheets[i].getBoundingClientRect().top <= line) best = i; else break; }
        if (best !== L().cur) setCur(best);
      };
      const key = (e) => {
        const t = e.target.tagName;
        if (t === 'SELECT' || t === 'INPUT' || t === 'TEXTAREA' || e.target.isContentEditable || e.metaKey || e.ctrlKey || e.altKey) return;
        const p = L().presenting, c = L().cur;
        if (e.code === 'KeyI' || e.key === 'i' || e.key === 'I') { A().setDev(!L().dev); e.preventDefault(); return; }
        if (e.key === 'F5' || ((e.key === 'f' || e.key === 'F') && !p)) { A().setPresent(true); e.preventDefault(); return; }
        if (p && (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown')) { A().go(c + 1); e.preventDefault(); return; }
        if (p && (e.key === 'ArrowUp' || e.key === 'Backspace')) { A().go(c - 1); e.preventDefault(); return; }
        if (p && e.key === 'Home') { A().go(0); e.preventDefault(); return; }
        if (p && e.key === 'End') { A().go(sheets.length - 1); e.preventDefault(); return; }
        if (p && e.key === 'Escape') { A().setPresent(false); return; }
        if (e.key === 'ArrowRight' || e.key === 'PageDown') { A().go(c + 1); e.preventDefault(); }
        else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { A().go(c - 1); e.preventDefault(); }
        else if (e.key === 'Escape' && L().stack.length) A().closePanel();
      };
      /* 근거 링크 · 장 안 .md 링크는 패널로, 이 설계서 안 장 id 는 그 장으로 */
      const click = (e) => {
        const md = e.target.closest && e.target.closest(".sheet a[href$='.md'], .sheet a[href*='.md#']");
        if (md && !md.classList.contains('sb-ref') && !(e.metaKey || e.ctrlKey || e.shiftKey)) { e.preventDefault(); A().openRef(md.textContent, [md.getAttribute('href')]); return; }
        const a = e.target.closest && e.target.closest('a.sb-ref');
        if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        if (a.dataset.inner) { const i = sheets.findIndex((s) => s.id === a.dataset.inner); if (i >= 0) A().go(i); return; }
        A().openRef(a.dataset.label || a.textContent, JSON.parse(a.dataset.hrefs));
      };
      const fs = () => { if (!fsEl() && L().presenting) A().setPresent(false); else if (L().presenting) SB.fitPresent(L().cur); };
      const resize = () => { if (L().presenting) SB.fitPresent(L().cur); };
      const print = () => { SB.clearPeek(); SB.fitPrint(); };
      window.addEventListener('scroll', scroll, { passive: true });
      document.addEventListener('keydown', key);
      document.addEventListener('click', click);
      document.addEventListener('fullscreenchange', fs);
      document.addEventListener('webkitfullscreenchange', fs);
      window.addEventListener('resize', resize);
      window.addEventListener('beforeprint', print);
      if (window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        main.current.addEventListener('mouseover', (e) => SB.peekAt(e.target));
        main.current.addEventListener('mouseleave', SB.clearPeek);
      }
    }, []);

    const back = document.body.getAttribute('data-back') || (SB.ROOT != null ? `${SB.ROOT}index.html` : null);
    const s = sheets[cur];
    return html`<header class="sb-top">
        <button class="sb-btn sb-thumb-toggle" title="미리보기 목록 열고 닫기" aria-label="미리보기 목록" aria-pressed=${thumbsOn} onClick=${() => { setThumbs(!thumbsOn); keep(THUMB_KEY, thumbsOn ? 'off' : 'on'); }}>☰</button>
        ${back ? html`<a class="sb-btn sb-back" href=${back} title="문서 사이트로 돌아가기">← 문서</a>` : null}
        <div class="sb-title">${SB.docTitle}</div>
        <select class="sb-sel" aria-label="구분" value=${s.dataset.group} onChange=${(e) => { const g = e.currentTarget.value; const i = sheets.findIndex((x) => x.dataset.group === g); if (i >= 0) go(i); }}>
          ${SB.groups.map((g) => html`<option value=${g}>${g}</option>`)}</select>
        <select class="sb-sel sb-sel-page" aria-label="장" value=${String(cur)} onChange=${(e) => go(parseInt(e.currentTarget.value, 10))}>
          ${sheets.map((x, i) => (x.dataset.group === s.dataset.group ? html`<option value=${String(i)}>${i + 1}. ${x.dataset.label}</option>` : null))}</select>
        <button class="sb-btn" title="이전 장 (←)" aria-label="이전 장" disabled=${cur === 0} onClick=${() => go(cur - 1)}>◀</button>
        <span class="sb-count">${cur + 1} / ${sheets.length}</span>
        <button class="sb-btn" title="다음 장 (→)" aria-label="다음 장" disabled=${cur === sheets.length - 1} onClick=${() => go(cur + 1)}>▶</button>
        <button class="sb-btn sb-zoom" aria-pressed=${presenting} title="현재 장부터 화면 가득 한 장씩 보기 (F5 · F, 넘기기 → · Space · 클릭, 끝내기 Esc)" onClick=${() => setPresent(true)}>▶ 발표</button>
        <button class="sb-btn sb-dev-btn" aria-pressed=${dev} title="개발자용 내부 정보 보이기 · 숨기기 (I): Check Point · 근거 줄 · 마커별 근거 ID · sb-dev. 켠 채 인쇄하면 함께 인쇄된다" onClick=${() => setDev(!dev)}>내부 정보</button>
        <button class="sb-btn sb-print" title="A4 가로로 전체 장 인쇄 (⌘/Ctrl+P 와 같음)" onClick=${() => window.print()}>인쇄</button>
      </header>
      <div class="sb-layout">
        <nav class="sb-thumbs" aria-label="장 미리보기" ref=${side}>
          ${SB.groups.map((g) => html`<details class="sb-group" open key=${g}><summary>${g}</summary>${sheets.map((x, i) => (x.dataset.group === g ? html`<${Thumb} key=${x.id} i=${i} on=${i === cur} over=${over[i]} dev=${dev} go=${go} />` : null))}</details>`)}
        </nav>
        <main class="sb-main" ref=${main} onClick=${(e) => { if (presenting && !(e.target.closest && e.target.closest('a, button, input, select'))) go(cur + 1); }}></main>
      </div>
      <${Panel} stack=${stack} close=${closePanel} back=${() => setStack((st) => st.slice(0, -1))} pick=${(k) => setStack((st) => [...st.slice(0, -1), { ...st[st.length - 1], i: k }])} />`;
  }

  const mount = document.createElement('div');
  mount.id = 'sb-app';
  document.body.insertBefore(mount, document.body.firstChild);
  window.preact.render(html`<${App} />`, mount);
})();
