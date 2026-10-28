/* 내보내기(SQL DDL · SVG · 인쇄 · 영역마다 한 쪽) · 앱 틀 · 단축키(/ 0 + − F Esc) · #스키마.테이블 주소 */
(function () {
  'use strict';
  const E = window.ERD, M = E.M, st = E.st, html = E.html, H = E.H;
  const NS = 'http://www.w3.org/2000/svg';
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const save = (name, text, type) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const slug = () => (M.title || 'erd').replace(/[^\w가-힣]+/g, '-').replace(/^-|-$/g, '');
  const ddl = (schemas) => window.ERD_DDL.ddl(M, schemas, { dialect: E.CONV.dialect, fkInDb: E.CONV.fkInDb, now: new Date().toLocaleString('sv-SE').slice(0, 16) });
  function svgText() {
    const svg = document.getElementById('svg');
    const b = svg.getBoundingClientRect();
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', NS);
    clone.setAttribute('width', b.width);
    clone.setAttribute('height', b.height);
    const style = document.createElementNS(NS, 'style');
    style.textContent = [...document.styleSheets].flatMap((ss) => { try { return [...ss.cssRules].map((r) => r.cssText); } catch (e) { return []; } }).join('\n');
    clone.prepend(style);
    return new XMLSerializer().serializeToString(clone);
  }
  // PDF · 영역마다 한 쪽: 영역마다 따로 배치한 그림을 쪽으로 모아 인쇄한다 (지금 고른 스키마 · 선 숨김 · 이름 보기 · 표시 수준 그대로)
  async function printAreas() {
    const keep = { areas: new Set(st.areas), x: st.x, y: st.y, k: st.k, arrange: st.arrange, overview: st.overview };
    st.arrange = 'rel'; st.overview = false; // 영역 하나씩이라 관계 중심으로 그린다
    const pages = [];
    for (const a of E.AREAS) {
      st.areas = new Set([a]);
      if (!M.tables.some(E.visible)) continue;
      await E.layout();
      const c = document.getElementById('svg').cloneNode(true);
      c.removeAttribute('id');
      c.setAttribute('viewBox', `0 0 ${st.W} ${st.H}`);
      c.querySelector('#vp').removeAttribute('transform');
      for (const n of c.querySelectorAll('[id]')) if (n.id !== 'one' && n.id !== 'many') n.removeAttribute('id');
      pages.push(`<section class="pg"><h2>${a === E.NOAREA ? '영역 꼬리표 없는 테이블' : `${esc(a)} 영역`} <small>${esc(M.title || '')} · 테이블 ${M.tables.filter(E.visible).length}</small></h2>${new XMLSerializer().serializeToString(c)}</section>`);
    }
    st.areas = keep.areas; st.arrange = keep.arrange; st.overview = keep.overview;
    await E.layout();
    Object.assign(st, { x: keep.x, y: keep.y, k: keep.k }); E.applyView();
    let box = document.getElementById('pages');
    if (!box) { box = document.createElement('div'); box.id = 'pages'; document.body.append(box); }
    box.innerHTML = pages.join('');
    document.body.classList.add('pages');
    const done = () => { document.body.classList.remove('pages'); box.innerHTML = ''; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
  }
  E.exportAs = (x) => {
    if (x === 'print') window.print();
    else if (x === 'print-areas') printAreas();
    else if (x === 'svg') save(`${slug()}.svg`, svgText(), 'image/svg+xml');
    else save(`${slug()}${x === 'sql-vis' ? '-visible' : ''}.sql`, ddl(x === 'sql-vis' ? M.schemas.filter((s) => !st.hidden.has(s)) : M.schemas), 'application/sql');
  };
  // 인쇄: 지금 보이는 그대로 쪽에 맞춘다
  let saved = null;
  window.addEventListener('beforeprint', () => { saved = { x: st.x, y: st.y, k: st.k }; const svg = document.getElementById('svg'); if (svg) svg.setAttribute('viewBox', `0 0 ${st.W} ${st.H}`); if (E.vpEl) E.vpEl.setAttribute('transform', ''); });
  window.addEventListener('afterprint', () => { const svg = document.getElementById('svg'); if (svg) svg.removeAttribute('viewBox'); if (saved) Object.assign(st, saved); E.applyView(); });

  function App() {
    const v = H.useState(0), bump = v[1];
    H.useLayoutEffect(() => { E.committed(); });
    H.useEffect(() => {
      E.render = () => bump((n) => n + 1);
      document.title = M.title;
      const key = (e) => {
        if (e.target.matches && e.target.matches('input')) return;
        if (e.key === '/') { e.preventDefault(); E.focusSearch(); }
        else if (e.key === '0') E.fit();
        else if (e.key === '+' || e.key === '=') E.zoomAt(1.2, ...E.mid());
        else if (e.key === '-') E.zoomAt(1 / 1.2, ...E.mid());
        else if (e.key === 'f' || e.key === 'F') E.fullscreen();
        else if (e.key === 'Escape') { if (st.ref) E.closeRef(); else E.select(null); }
      };
      const fromHash = () => { let h = ''; try { h = decodeURIComponent(location.hash.slice(1)); } catch (e) { /* 잘못된 주소 */ } if (E.byId.has(h) && h !== st.sel) E.select(h, true); };
      const fs = () => setTimeout(() => E.fit(), 50);
      document.addEventListener('keydown', key);
      window.addEventListener('hashchange', fromHash);
      window.addEventListener('resize', E.fitK);
      document.addEventListener('fullscreenchange', fs);
      if (typeof window.ELK === 'undefined') { st.err = '배치 엔진(assets/erd/elk.bundled.js)을 불러오지 못했습니다. kedovi docs build 로 다시 만든다'; bump((n) => n + 1); }
      else {
        // 영역 꼬리표가 있으면 영역 배치 + 영역 개요로 연다
        if (E.AREAS.length) { st.arrange = 'area'; st.overview = true; }
        E.layout().then(() => E.fit()).then(fromHash).then(() => document.documentElement.classList.add('erd-ready'));
      }
      return () => { document.removeEventListener('keydown', key); window.removeEventListener('hashchange', fromHash); window.removeEventListener('resize', E.fitK); document.removeEventListener('fullscreenchange', fs); };
    }, []);
    return html`<${E.Bar} />
      <main><${E.List} />
        <${E.Canvas}><${E.Detail} /><${E.Ref} /><${E.Tools} /><${E.Legend} /></${E.Canvas}>
      </main>`;
  }

  const mount = document.getElementById('erd-app');
  mount.textContent = '';
  window.preact.render(html`<${App} />`, mount);
})();
