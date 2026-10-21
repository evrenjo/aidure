/* 머리 줄(← 문서 · 제목 · 검색 · 스키마 · 영역 · Export · 테마) · 왼쪽 표 목록(스키마 → 영역 → 표, 접기) */
(function () {
  'use strict';
  const E = window.ERD, M = E.M, st = E.st, html = E.html, H = E.H;
  const { byId, AREAS } = E;

  /** 펼침 메뉴 하나: 바깥을 누르면 닫힌다 */
  function Menu(props) {
    const o = H.useState(false), open = o[0], set = o[1];
    H.useEffect(() => {
      if (!open) return;
      const close = () => set(false);
      document.addEventListener('click', close);
      return () => document.removeEventListener('click', close);
    }, [open]);
    return html`<span class="menu" id=${props.wrapId}><button id=${props.id} aria-haspopup="true" aria-expanded=${open} title=${props.title} onClick=${(e) => { e.stopPropagation(); set(!open); }}>${props.label}</button>
      <span id=${props.menuId} class="pop" role="menu" hidden=${!open} onClick=${(e) => { e.stopPropagation(); if (e.target.closest('[data-close]')) set(false); }}>${open ? props.children : null}</span></span>`;
  }

  function SchemaMenu() {
    const q = H.useState('');
    const shown = M.schemas.filter((s) => !q[0] || s.toLowerCase().includes(q[0].trim().toLowerCase()));
    const set = (s, on) => { if (on) st.hidden.delete(s); else st.hidden.add(s); };
    const all = (on) => { for (const s of shown) set(s, on); if (st.hidden.size === M.schemas.length) st.hidden.delete(M.schemas[0]); E.applySchemas(); };
    return html`<${Menu} id="schemaBtn" menuId="schemaMenu" title="보일 스키마 고르기" label=${html`스키마 <b id="schemaCount">${M.schemas.length - st.hidden.size}/${M.schemas.length}</b> ▾`}>
      <input id="schemaQ" type="search" placeholder="스키마 찾기" autocomplete="off" value=${q[0]} onInput=${(e) => q[1](e.currentTarget.value)} ref=${(el) => el && setTimeout(() => el.focus(), 0)} />
      <span class="row"><button onClick=${() => all(true)}>전체 선택</button><button onClick=${() => all(false)}>전체 해제</button></span>
      <span id="schemaList" class="checks">${shown.map((s) => html`<label key=${s}><input type="checkbox" checked=${!st.hidden.has(s)} onChange=${(e) => {
        set(s, e.currentTarget.checked);
        if (st.hidden.size === M.schemas.length) st.hidden.delete(s);   // 하나는 남긴다
        E.applySchemas();
      }} /><i style=${`background:${E.color(s)}`}></i>${s}<span class="n">${M.tables.filter((t) => t.schema === s).length}</span></label>`)}</span>
    </${Menu}>`;
  }

  /** 영역 고르기: 정의서에 「영역: …」 이 있을 때만. 모두 고르면 거르지 않는다 */
  function AreaMenu() {
    return html`<${Menu} wrapId="areaWrap" id="areaBtn" menuId="areaMenu" title="보일 주제 영역 고르기 (정의서 설명 줄의 「영역: …」)" label=${html`영역 <b id="areaCount">${st.areas.size}/${AREAS.length}</b> ▾`}>
      <span class="row"><button onClick=${() => { st.areas = new Set(AREAS); E.applySchemas(); }}>전체 선택</button><button onClick=${() => { st.areas = new Set([AREAS[0]]); E.applySchemas(); }}>하나만</button></span>
      <span id="areaList" class="checks">${AREAS.map((a) => html`<label key=${a}><input type="checkbox" checked=${st.areas.has(a)} onChange=${(e) => {
        if (e.currentTarget.checked) st.areas.add(a); else st.areas.delete(a);
        if (!st.areas.size) st.areas.add(a);   // 하나는 남긴다
        E.applySchemas();
      }} />${a}<span class="n">${M.tables.filter((t) => E.areasOf(t).includes(a)).length}</span></label>`)}</span>
    </${Menu}>`;
  }

  function ExportMenu() {
    const dia = window.ERD_DDL ? window.ERD_DDL.NAMES[window.ERD_DDL.dialectOf(E.CONV.dialect)] : 'PostgreSQL';
    const x = (k, label, extra) => html`<button data-close="1" role="menuitem" class=${extra || ''} onClick=${() => E.exportAs(k)}>${label}</button>`;
    return html`<${Menu} id="export" menuId="exportMenu" label="Export ▾">
      ${x('sql-all', html`SQL · <span class="dia">${dia}</span> DDL (전체 스키마)`)}
      ${x('sql-vis', html`SQL · <span class="dia">${dia}</span> DDL (보이는 스키마만)`)}
      ${x('svg', '그림 · SVG (지금 보이는 그대로)')}
      ${x('print', 'PDF · A4 가로 인쇄 (지금 보이는 그대로)')}
      ${AREAS.length ? x('print-areas', 'PDF · 영역마다 한 쪽 (A4 가로)', 'areas-only') : null}
    </${Menu}>`;
  }

  E.Bar = function Bar() {
    const qRef = H.useRef(null);
    E.focusSearch = () => qRef.current && qRef.current.focus();
    const back = document.body.dataset.back;
    const root = document.body.dataset.root || '';
    return html`<header class="bar">
      <div class="left"><a class="back" id="back" href=${back || `${root}index.html`} title="데이터 설계 개요로">← 문서</a><b class="title" id="title">${M.title}</b></div>
      <div class="center"><input id="q" ref=${qRef} type="search" placeholder="테이블 · 컬럼 검색 (논리명 · 물리명, /)" autocomplete="off" value=${st.q}
        onInput=${(e) => { st.q = e.currentTarget.value.trim(); E.update(); }}
        onKeyDown=${(e) => {
          if (e.key === 'Enter') { const m = E.matches(); if (m && m.size) E.select([...m][0], true); }
          if (e.key === 'Escape') { st.q = ''; e.currentTarget.value = ''; E.update(); e.currentTarget.blur(); }
        }} /></div>
      <div class="right"><${SchemaMenu} />${AREAS.length ? html`<${AreaMenu} />` : null}<${ExportMenu} /><button id="theme" title="테마" onClick=${E.setTheme}>◐</button></div>
    </header>`;
  };

  /** 왼쪽 목록: 스키마 → (영역) → 표. 접기는 브라우저에 기억(ERD 마다 따로) · ⌖ 는 캔버스를 그 스키마 · 영역에 맞춘다 */
  const foldKey = `erd.fold:${M.title || ''}`;
  const areaKeys = () => M.schemas.flatMap((s) => AREAS.filter((a) => M.tables.some((t) => t.schema === s && t.listArea === a)).map((a) => `${s}/${a}`));
  st.fold = (() => { try { return new Set(JSON.parse(E.load(foldKey, '[]'))); } catch (e) { return new Set(); } })();
  st.fold = new Set([...st.fold].filter((k) => M.schemas.includes(k) || areaKeys().includes(k)));
  const saveFold = () => E.keep(foldKey, JSON.stringify([...st.fold]));

  /* 접기 표시: 선 화살표(Lucide chevron-right, ISC). 펼치면 아래로 돈다 */
  const Chev = (open) => html`<svg class=${`tw${open ? ' open' : ''}`} viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>`;

  E.List = function List() {
    const hit = E.matches();
    // 접힌 스키마라도 검색에 맞는 표 · 고른 표가 있으면 펼쳐 보인다 (접기 단위: 스키마 · 스키마/영역)
    const open = new Set([...(hit || [])].flatMap((id) => { const t = byId.get(id); return [t.schema, `${t.schema}/${t.listArea}`]; }));
    if (st.sel) { const t = byId.get(st.sel); open.add(t.schema); open.add(`${t.schema}/${t.listArea}`); }
    const folded = (k) => st.fold.has(k) && !open.has(k);
    const toggle = (k) => { if (st.fold.has(k)) st.fold.delete(k); else st.fold.add(k); saveFold(); E.update(); };
    const key = (k) => (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(k); } };
    const item = (t) => {
      const [x, y] = E.label(t.logical, t.name);
      return html`<a key=${t.id} href=${`#${t.id}`} title=${t.desc} class=${`${AREAS.length ? 'in-area' : ''}${t.id === st.sel ? ' on' : ''}${hit && !hit.has(t.id) ? ' dim' : ''}`}
        style=${E.visible(t) ? '' : 'display:none'} onClick=${(e) => { e.preventDefault(); if (!E.visible(t)) return; E.select(t.id, true); history.replaceState(null, '', `#${t.id}`); }}>${x}${y ? html` <span class="sub">${y}</span>` : null}</a>`;
    };
    // 관계 중심 배치에서는 한 스키마의 표가 전체에 흩어진다: 스키마 묶기를 켜고 그 상자에 맞춘다
    const goSchema = async (s) => {
      if (st.hidden.has(s)) return;
      if (st.arrange === 'rel' || st.overview) { if (st.arrange === 'rel') st.arrange = 'schema'; st.overview = false; await E.layout(); }
      E.fitTables(M.tables.filter((t) => t.schema === s && E.visible(t)).map((t) => t.id));
    };
    return html`<nav id="list" aria-label="테이블 목록">
      <${window.SideHead} label=${`테이블 ${M.tables.length}`} anyOpen=${[...M.schemas, ...areaKeys()].some((k) => !st.fold.has(k))}
        onToggle=${(open) => { st.fold = open ? new Set() : new Set([...M.schemas, ...areaKeys()]); saveFold(); E.update(); }} />
      ${M.schemas.map((s) => {
        const fs = folded(s);
        const ts = M.tables.filter((t) => t.schema === s);
        const head = html`<h4 key=${`h:${s}`} role="button" tabindex="0" title="누르면 표 목록을 접고 편다" aria-expanded=${!fs} style=${st.hidden.has(s) ? 'display:none' : ''}
          onClick=${(e) => { if (!e.target.closest('.go')) toggle(s); }} onKeyDown=${key(s)}>${Chev(!fs)}<i style=${`background:${E.color(s)}`}></i>${s} <span class="sub">${ts.length}</span>
          <button class="go" title="이 스키마로 이동 (스키마 묶기를 켜고 그 상자에 맞춘다)" aria-label=${`${s} 스키마로 이동`} onClick=${() => goSchema(s)}>⌖</button></h4>`;
        if (!AREAS.length) return [head, ...(fs ? [] : ts.map(item))];
        return [head, ...AREAS.flatMap((a) => {
          const at = ts.filter((t) => t.listArea === a);
          if (!at.length || fs) return [];
          const k = `${s}/${a}`, fa = folded(k);
          return [html`<h5 key=${`a:${k}`} role="button" tabindex="0" aria-expanded=${!fa} style=${st.hidden.has(s) || (E.areaOn() && !st.areas.has(a)) ? 'display:none' : ''}
            onClick=${(e) => { if (e.target.closest('.go')) { E.goArea(k); return; } toggle(k); }} onKeyDown=${key(k)}>${Chev(!fa)}${E.areaName(a)} <span class="sub">${at.length}</span>
            <button class="go" title="이 영역으로 이동 (영역 배치로 바꾸고 그 덩어리에 맞춘다)" aria-label=${`${E.areaName(a)} 영역으로 이동`}>⌖</button></h5>`, ...(fa ? [] : at.map(item))];
        })];
      })}
    </nav>`;
  };
})();
