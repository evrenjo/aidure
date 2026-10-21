/* 상세 드로어 · 근거 패널 · 아래 범례 · 위 조작 막대 */
(function () {
  'use strict';
  const E = window.ERD, M = E.M, st = E.st, html = E.html, H = E.H;
  const { byId, rels, lrels, HUB, AREAS, CONV } = E;
  const REFS = M.refs || {};

  // 근거: 기능 ID · 결정 ID 를 누르면 오른쪽 패널에 그 문서 (색인 assets/ids.json 을 docs build 가 모델의 refs 로 넣는다)
  const ID_RE = /(?<![\w-])([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\d+)(?![\w-])/g;
  /** 글자 속 ID 를 근거 링크로 */
  function idLinks(text) {
    const out = [];
    let last = 0;
    for (const m of String(text || '').matchAll(ID_RE)) {
      if (!REFS[m[1]]) continue;
      out.push(text.slice(last, m.index), html`<a class="idref" onClick=${() => E.openRef(m[1], REFS[m[1]])}>${m[1]}</a>`);
      last = m.index + m[1].length;
    }
    out.push(String(text || '').slice(last));
    return out;
  }

  /** 상세 드로어: 테이블을 누르면 오른쪽에서 나오고, Esc · × · 빈 곳 클릭이면 닫힌다 */
  E.Detail = function Detail() {
    const ref = H.useRef(null);
    H.useLayoutEffect(() => { E.detailEl = ref.current; });
    const id = st.sel, t = id && byId.get(id);
    const body = () => {
      const kb = (c) => [['pk', c.pk], ['fk', c.fk], ['uk', c.uk]].filter((x) => x[1]).map(([k]) => html`<i class=${`k ${k}`}>${k.toUpperCase()}</i> `);
      const out = rels.filter((r) => r.to === id), inc = rels.filter((r) => r.from === id);
      const lout = lrels.filter((r) => r.to === id), linc = lrels.filter((r) => r.from === id);
      const go = (tid, txt) => html`<a onClick=${() => E.select(tid, true)}>${txt}</a>`;
      const fn = (f) => (REFS[f] ? html`<a class="fn idref" title="근거 문서 열기" onClick=${() => E.openRef(f, REFS[f])}>${f}</a>` : html`<span class="fn" title="색인에 없는 ID">${f}</span>`);
      const areas = t.areas || [];
      const tags = [areas.length ? `영역: ${areas.join(' · ')}` : '', t.code ? '분류: 코드' : '', HUB.has(id) ? '선 숨김 대상' : ''].filter(Boolean).join(' · ');
      const store = [t.partition ? `파티션: ${t.partition}` : '', t.retention ? `보존: ${t.retention}` : ''].filter(Boolean).join(' · ');
      const lines = (list) => list.reduce((a, x, i) => (i ? [...a, html`<br />`, x] : [x]), []);
      return html`<h3 style=${`color:${E.color(t.schema)}`}>${t.logical || t.name} <small>${t.id}</small></h3>
        <div class="sub">${idLinks(t.desc)}${t.src ? html` <a class="src idref" title="정의서(md) 보기" onClick=${() => E.openRef(`${t.id} 정의서`, [t.src])}>정의서</a>` : null}</div>
        <div>${t.fns.length ? t.fns.map(fn) : html`<span class="sub">${t.noFns ? '기능: 없음' : '기능 ID 없음'}</span>`}</div>
        ${tags ? html`<div class="sub">${tags}</div>` : null}
        ${store ? html`<div class="sub">${store}</div>` : null}
        <h5>컬럼 ${t.columns.length}</h5>
        <table><tr><th>키</th><th>논리명 · 물리명</th><th>타입</th><th>널</th><th>설명</th></tr>
        ${t.columns.map((c) => html`<tr><td>${kb(c)}</td><td>${c.logical || ''}<br /><span class="c">${c.name}</span></td><td class="c">${c.type}</td><td>${c.nullable ? 'Y' : ''}</td>
          <td>${idLinks(c.desc)}${c.ref ? html`<br /><span class="rel">${c.lref ? '⇢ 논리 ' : '→ '}${go(c.ref.split('.').slice(0, 2).join('.'), c.ref)}</span>` : null}</td></tr>`)}
        </table>
        <h5>참조함 (이 테이블 → 부모) ${out.length}</h5>
        <div class="rel">${out.length ? lines(out.map((r) => html`${r.toCol} → ${go(r.from, `${r.from}.${r.fromCol}`)}`)) : html`<span class="sub">없음</span>`}</div>
        <h5>참조받음 (자식 → 이 테이블) ${inc.length}</h5>
        <div class="rel">${inc.length ? lines(inc.map((r) => go(r.to, `${r.to}.${r.toCol}`))) : html`<span class="sub">없음</span>`}</div>
        ${lout.length || linc.length ? html`<h5>논리 참조 (DB 외래키 없음) ${lout.length} · 받음 ${linc.length}</h5>
          <div class="rel">${lines([...lout.map((r) => html`${r.toCol} ⇢ ${go(r.from, `${r.from}${r.fromCol ? `.${r.fromCol}` : ''}`)}`), ...linc.map((r) => html`${go(r.to, `${r.to}.${r.toCol}`)} ⇢ 이 테이블`)])}</div>` : null}`;
    };
    return html`<aside id="detail" ref=${ref} class=${t ? 'open' : ''} aria-label="테이블 상세" aria-hidden=${!t}>
      <button id="dclose" title="닫기 (Esc)" aria-label="닫기" onClick=${() => E.select(null)}>×</button><div id="dbody">${t ? body() : null}</div></aside>`;
  };

  /** 근거 패널: 여러 문서에 있으면 칩으로 고른다 */
  E.Ref = function Ref() {
    const r = st.ref;
    if (!r) return html`<aside id="ref" hidden></aside>`;
    const h = r.hrefs[r.i] || r.hrefs[0];
    const short = (x) => x.split('#')[0].replace(/\/index\.html$/, '').replace(/^.*?([^/]+\/[^/]+|[^/]+)$/, '$1');
    return html`<aside id="ref" aria-label="근거 문서">
      <div class="rbar"><span id="rtitle">${r.label}</span><a id="ropen" target="_blank" rel="noopener" href=${h}>새 탭</a><button id="rclose" title="닫기 (Esc)" aria-label="근거 패널 닫기" onClick=${E.closeRef}>×</button></div>
      <div id="rlist">${r.hrefs.length > 1 ? html`<span>여러 문서에 있음:</span>${r.hrefs.map((x, i) => html`<button class=${i === r.i ? 'on' : ''} onClick=${() => { st.ref = { ...r, i }; E.update(); }}>${short(x)}</button>`)}` : null}</div>
      <iframe id="rframe" title="근거 문서" src=${h}></iframe>
    </aside>`;
  };

  E.Legend = function Legend() {
    const lv = st.overview && E.areaMode() ? '영역 개요: 카드를 누르면 그 영역으로' : `표시 수준: ${E.LEVEL_NAME[st.level]}${st.mode === 'auto' ? ' (자동)' : ''}`;
    return html`<div id="legend"><b id="lv">${lv}</b><span><i class="k pk">PK</i> 기본키</span><span><i class="k fk">FK</i> 참조</span><span><i class="k uk">UK</i> 유일</span><span>선: 참조 받는 쪽 ┼ · 참조하는 쪽 ⋔ (1:N), 점선 = 널 허용</span>${st.lrefs ? html`<span id="lgLegend"><i class="lgk"></i> 논리 참조 (DB 외래키 없음)</span>` : null}</div>`;
  };

  /** 위 조작 막대: 배치 · 영역 개요 · 선 · 이름 보기 · 표시 수준 · 확대 */
  E.Tools = function Tools() {
    const zoom = H.useRef(null);
    H.useLayoutEffect(() => { E.zoomEl = zoom.current; E.applyView(); });
    const relayout = async (fitStay) => { await E.layout(); if (fitStay) E.fit(true); };
    const arrange = async (a) => { if (a === st.arrange && !st.overview) return; st.arrange = a; st.overview = false; await relayout(true); };   // 고른 배치를 그대로 보인다 (맞춤 · 0 키는 영역 개요로 갈 수 있다)
    const level = async (v) => {
      st.mode = v;
      if (st.overview && E.areaMode()) { st.overview = false; await E.layout(); await E.fit(true); }
      const m = E.mid();
      if (st.mode === 'auto') { const want = E.levelFor(st.k); if (want !== st.level) await E.switchLevel(want, ...m); else E.update(); }
      else await E.switchLevel(st.mode, ...m);
      E.update();
    };
    const names = async (n) => { st.names = n; E.keep('erd.names', n); await E.layout(); };
    const seg = (id, label, list, cur, pick) => html`<span id=${id} class="seg" role="group" aria-label=${label}>${list.map(([v, t, title]) => html`<button class=${v === cur ? 'on' : ''} title=${title} onClick=${() => pick(v)}>${t}</button>`)}</span>`;
    const area = AREAS.length > 0, ov = st.overview && E.areaMode();
    // 좁은 캔버스(세로 iPad 등): 보기 설정은 「보기 ▾」 한 메뉴로 접고 확대 단추만 한 줄에 (단추가 줄바꿈으로 흩어지지 않게)
    const ns = H.useState(false), narrow = ns[0];
    const os = H.useState(false), open = os[0], setOpen = os[1];
    H.useEffect(() => {
      const el = E.stageEl;
      if (!el || !window.ResizeObserver) return;
      const ro = new ResizeObserver(() => ns[1](el.clientWidth < 1180));
      ro.observe(el);
      return () => ro.disconnect();
    }, []);
    H.useEffect(() => {
      if (!open) return;
      const close = (e) => { if (!e.target.closest('#tools')) setOpen(false); };
      document.addEventListener('pointerdown', close);
      return () => document.removeEventListener('pointerdown', close);
    }, [open]);
    const view = html`
      <span class="tl"><span class="grp-l">배치</span>${seg('arrange', '배치', [
        ...(area ? [['area', '영역', '영역(정의서의 「영역: …」)마다 덩어리로 묶어 바둑판으로 놓는다. 덩어리 안은 부모 → 자식 위에서 아래로, 덩어리 사이 선은 숨긴다']] : []),
        ['schema', '스키마', '스키마마다 상자로 묶는다'], ['rel', '관계', '묶지 않고 관계있는 테이블끼리 가깝게']], st.arrange, arrange)}
      ${area ? html`<button id="overview" class=${ov ? 'on' : ''} aria-pressed=${ov} title="영역마다 카드 하나(영역 이름 · 테이블 수 · 대표 테이블). 카드를 누르면 그 영역으로 확대" onClick=${async () => { st.arrange = 'area'; st.overview = !st.overview; await relayout(true); }}>영역 개요</button>` : null}</span>
      <span class="tl">${E.areaMode() ? html`<label class="tg" id="xareaWrap" title="영역 배치에서 덩어리 사이 외래키를 덩어리 → 덩어리 요약선 하나에 개수로 보인다"><input type="checkbox" id="xarea" checked=${st.xarea} onChange=${(e) => { st.xarea = e.currentTarget.checked; E.layout(); }} /> 영역 사이 선</label>` : null}
      ${lrels.length ? html`<label class="tg" id="lrefsWrap" title=${`논리 참조(참조 칸 「논리: …」, DB 외래키 없음) ${lrels.length}개를 점선으로 그린다. 영역 배치에서 덩어리 사이는 덩어리 → 덩어리 요약선 하나에 개수`}><input type="checkbox" id="lrefs" checked=${st.lrefs} onChange=${(e) => { st.lrefs = e.currentTarget.checked; E.layout(); }} /> 논리 참조</label>` : null}
      ${HUB.size ? html`<label class="tg" title=${`들어오는 관계가 ${CONV.hubMin || 10}개 이상인 표 · 코드 표(분류: 코드) · 「ERD: 선 숨김」 표로 가는 선을 숨기고 그 선 없이 배치한다 (${HUB.size}개 표). 표를 고르면 그 표의 선은 보인다`}><input type="checkbox" id="hubs" checked=${st.hideHub} onChange=${(e) => { st.hideHub = e.currentTarget.checked; E.keep('erd.hub', st.hideHub ? 'on' : 'off'); relayout(true); }} /> 참조 많은 표 선 숨김</label>` : null}</span>
      ${narrow ? null : html`<i class="sep"></i>`}
      <span class="tl"><span class="grp-l">이름</span>${seg('names', '이름 보기', [['both', '논·물리명', '논리명과 물리명'], ['logical', '논리명', '논리명 (Logical)'], ['physical', '물리명', '물리명 (Physical)']], st.names, names)}</span>
      <span class="tl"><span class="grp-l">표시 수준</span>${seg('levels', '표시 수준(Display Level)', [['auto', '자동', '자동 (Semantic Zoom): 확대 비율에 따라 바뀜'], ['concept', '테이블', 'Entity / Table: 테이블 이름 · 컬럼 수 · 관계 수'], ['compact', '키', 'Keys: 기본키 · 외래키 · 유일키'], ['full', '컬럼', 'Attribute / Column: 모든 컬럼']], st.mode, level)}</span>`;
    const zoomBar = html`<button id="zout" title="축소 (−)" onClick=${() => E.zoomAt(1 / 1.2, ...E.mid())}>－</button><b id="zoom" ref=${zoom} title="확대 비율">100%</b><button id="zin" title="확대 (+)" onClick=${() => E.zoomAt(1.2, ...E.mid())}>＋</button>
      <button id="fit" title="화면에 맞추기 (0)" onClick=${() => E.fit()}>맞춤</button>
      <button id="full" title="전체 화면 (F)" onClick=${E.fullscreen}>⛶</button>`;
    if (narrow) return html`<div id="tools" class="compact" role="toolbar" aria-label="화면 조작">
      <span class="menu"><button id="viewBtn" class=${open ? 'on' : ''} aria-haspopup="true" aria-expanded=${open} title="배치 · 선 · 이름 · 표시 수준" onClick=${() => setOpen(!open)}>보기 ▾</button>
        ${open ? html`<div class="pop view-pop" role="menu">${view}</div>` : null}</span>
      <i class="sep"></i>${zoomBar}
    </div>`;
    return html`<div id="tools" role="toolbar" aria-label="화면 조작">${view}<i class="sep"></i>${zoomBar}</div>`;
  };
  E.fullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : E.stageEl.requestFullscreen());
})();
