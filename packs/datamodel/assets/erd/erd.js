/* ERD 뷰어: aikit docs build 가 정의서(md)에서 만든 모델(window.ERD_MODEL)을 elkjs 로 배치하고 SVG 로 그린다 (datamodel 팩).
 * 모델 = { title, schemas, tables, conv: { dialect, fkInDb }, refs: { ID: [근거 문서 주소] } }. 테이블의 src = 정의서 쪽 주소 */
(() => {
  'use strict';
  const M = window.ERD_MODEL;
  const NS = 'http://www.w3.org/2000/svg';
  const $ = (s) => document.querySelector(s);
  const svg = $('#svg');
  const vp = $('#vp');
  const stage = $('#stage');
  const ROW = 19;
  const HEAD = 28;
  const st = { cf: 24, hidden: new Set(), fold: new Set(), areas: null, hideHub: (() => { try { return localStorage.getItem('erd.hub') === 'on'; } catch (e) { return false; } })(), level: 'compact', mode: 'auto', switching: false, cache: new Map(), arrange: 'rel', overview: false, lrefs: false, xarea: false, names: (() => { try { return localStorage.getItem('erd.names') || 'both'; } catch (e) { return 'both'; } })(), sel: null, q: '', k: 1, x: 0, y: 0, W: 0, H: 0, pos: new Map(), edges: [] };
  const byId = new Map(M.tables.map((t) => [t.id, t]));
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const color = (schema) => css(`--s${M.schemas.indexOf(schema) % 6}`);
  const el = (tag, attrs = {}, text) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text != null) e.textContent = text;
    return e;
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // 관계: 부모(참조 받는 쪽) → 자식(FK 쪽)
  const rels = [];
  for (const t of M.tables) for (const c of t.columns) if (c.fk) {
    const m = c.ref.match(/^(\w+)\.(\w+)\.(\w+)$/);
    if (m && byId.has(`${m[1]}.${m[2]}`)) rels.push({ from: `${m[1]}.${m[2]}`, fromCol: m[3], to: t.id, toCol: c.name, nullable: c.nullable });
  }
  // 논리 참조: 키에 FK 없이 참조 칸에 「논리: 스키마.테이블[.컬럼]」. DB 외래키가 없어 배치에 넣지 않고, 켜면 점선으로 그린다
  const lrels = [];
  for (const t of M.tables) for (const c of t.columns) if (c.lref && !c.fk) {
    const m = c.ref.match(/^(\w+)\.(\w+)(?:\.(\w+))?$/);
    if (m && byId.has(`${m[1]}.${m[2]}`)) lrels.push({ from: `${m[1]}.${m[2]}`, fromCol: m[3] || '', to: t.id, toCol: c.name, nullable: c.nullable, logical: true });
  }
  const allRels = () => (st.lrefs ? [...rels, ...lrels] : rels);

  // 선을 숨길 표(「참조 많은 표 선 숨기기」): 들어오는 관계가 hubMin(기본 10) 이상 · 「분류: 코드」 · 「ERD: 선 숨김」 · vars.datamodel.erdHideEdgesTo
  const CONV = M.conv || {};
  const HUB = new Set(M.tables.filter((t) => t.code || t.hideEdges || (CONV.hideEdgesTo || []).includes(t.id) || rels.filter((r) => r.from === t.id).length >= (CONV.hubMin || 10)).map((t) => t.id));
  const hubRel = (r) => st.hideHub && HUB.has(r.from);
  // 주제 영역(「영역: …」): 고른 영역의 테이블만 그린다. 꼬리표가 없는 테이블은 「영역 없음」
  const NOAREA = '(영역 없음)';
  const areasOf = (t) => (t.areas && t.areas.length ? t.areas : [NOAREA]);
  const AREAS = (() => { const a = [...new Set(M.tables.flatMap((t) => t.areas || []))]; return a.length ? [...a, ...(M.tables.some((t) => !(t.areas || []).length) ? [NOAREA] : [])] : []; })();
  st.areas = new Set(AREAS);
  const areaOn = () => AREAS.length && st.areas.size < AREAS.length;
  const visible = (t) => !st.hidden.has(t.schema) && (!areaOn() || areasOf(t).some((a) => st.areas.has(a)));
  // 영역 밖 표와의 관계: 선 대신 상자 아래에 「→ 표」 한 줄
  const outside = (t) => (areaOn() ? [...new Set(rels.filter((r) => (r.from === t.id || r.to === t.id)).map((r) => (r.from === t.id ? r.to : r.from)).filter((id) => id !== t.id && !visible(byId.get(id))))] : []);
  const OUT_H = () => (st.level === 'concept' ? 22 * cs() : 16);

  // 표시 수준(Display Level): concept = 테이블(이름만), compact = 키(PK · FK · UK), full = 컬럼(전체)
  // 「자동」 이면 확대 비율에 따라 단계가 바뀐다(경계에 여유를 둬 깜빡이지 않게)
  const LEVELS = ['concept', 'compact', 'full'];
  const LEVEL_NAME = { concept: '테이블', compact: '키', full: '컬럼' }; // erwin · ER/Studio Display Level 의 Table · Keys · Column
  const levelFor = (k, cur) => {
        const up = { concept: 0.6, compact: 1.0 }; // 이 비율보다 크면 한 단계 위로
    const down = { compact: 0.45, full: 0.9 }; // 이 비율보다 작으면 한 단계 아래로
    if (!cur) return k < 0.45 ? 'concept' : k < 0.95 ? 'compact' : 'full';
    if (cur !== 'full' && k > up[cur]) return LEVELS[LEVELS.indexOf(cur) + 1];
    if (cur !== 'concept' && k < down[cur]) return LEVELS[LEVELS.indexOf(cur) - 1];
    return cur;
  };
  const shownCols = (t) => (st.level === 'full' ? t.columns : st.level === 'compact' ? t.columns.filter((c) => c.pk || c.fk || c.uk) : []);
  // 이름 보기: both = 논리명 + 물리명, logical = 논리명, physical = 물리명 (논리명이 없으면 물리명)
  const tw = (str, px) => [...String(str)].reduce((w, ch) => w + (ch.charCodeAt(0) < 128 ? px * 0.62 : px * 1.02), 0);
  const label = (logical, physical) => {
    if (st.names === 'physical' || !logical) return [physical, ''];
    if (st.names === 'logical') return [logical, ''];
    return [logical, physical];
  };
  const labelW = (logical, physical, px) => { const [a, b] = label(logical, physical); return tw(a, px) + (b ? tw(b, px - 1.5) + 8 : 0); };
  // 개념 보기는 축소해서 보므로 글자를 크게 그린다
  // 테이블이 많아 크게 줄여 볼 때도 [테이블] 수준 글자가 화면에서 비슷한 크기로 보이게 글자 크기(st.cf)를 확대 비율에 맞춰 다시 정한다
  const cs = () => st.cf / 24;
  const CH0 = 56;
  const CH = () => CH0 * cs();
  const width = (t) => (st.level === 'concept' ? Math.max(220 * cs(), labelW(t.logical, t.name, st.cf) + 40 * cs()) : Math.max(170, labelW(t.logical, t.name, 12) + 30, ...shownCols(t).map((c) => labelW(c.logical, c.name, 11.5) + tw(c.type, 10.5) + 72)));
  const height = (t) => (st.level === 'concept' ? CH() + 36 * cs() : HEAD + Math.max(1, shownCols(t).length) * ROW + (t.columns.length > shownCols(t).length ? 16 : 0) + 6) + (outside(t).length ? OUT_H() : 0);

  // 영역 덩어리(영역 배치 · 영역 개요): 스키마 안의 영역 하나. 여러 영역에 든 표는 첫 영역(목록과 같다)
  for (const t of M.tables) t.listArea = areasOf(t)[0];
  const chunkOf = (t) => `${t.schema}/${t.listArea}`;
  const splitKey = (k) => { const i = k.indexOf('/'); return [k.slice(0, i), k.slice(i + 1)]; };
  const areaName = (a) => (a === NOAREA ? '영역 없음' : a);
  const areaMode = () => st.arrange === 'area' && AREAS.length > 0;
  // 화면 비율: 덩어리 · 카드를 바둑판으로 놓을 때 이 비율에 맞춰 열 수가 정해진다
  const aspect = () => { const b = stage.getBoundingClientRect(); return Math.max(0.8, Math.min(3, (b.width || 1600) / (b.height || 900))); };
  const chunks = (vis) => M.schemas.filter((s) => !st.hidden.has(s)).map((s) => ({ s, areas: AREAS.map((a) => ({ a, key: `${s}/${a}`, kids: vis.filter((t) => t.schema === s && t.listArea === a) })).filter((x) => x.kids.length) })).filter((x) => x.areas.length);
  // 영역 제목 글자: [테이블] 수준은 글자를 키운 만큼 같이 키운다
  const areaFont = () => (st.level === 'concept' ? Math.round(st.cf * 0.9) : 16);
  const degree = (id) => rels.filter((r) => r.from === id || r.to === id).length + lrels.filter((r) => r.from === id || r.to === id).length / 2;
  // 영역 개요 카드: 영역 이름 · 테이블 수 · 대표 테이블(관계가 많은 순 3개)
  const CARD_F = 22;
  const cardRows = 3;
  const cardSize = (a, kids) => ({ width: Math.max(280, tw(areaName(a), CARD_F) + 48, ...kids.slice(0, cardRows).map((t) => tw(t.logical || t.name, 14) + 40)), height: 54 + 28 + cardRows * 21 + 14 });
  const repOf = (kids) => [...kids].sort((x, y) => degree(y.id) - degree(x.id) || M.tables.indexOf(x) - M.tables.indexOf(y));

  const cacheKey = () => [st.level, st.level === 'concept' ? st.cf : 0, st.names, st.arrange, st.overview, areaMode() ? aspect().toFixed(1) : '', [...st.hidden].sort().join(','), st.hideHub, areaOn() ? [...st.areas].sort().join(',') : ''].join('|');
  async function layout() {
    const key = cacheKey();
    if (!st.cache.has(key)) st.cache.set(key, compute());
    const { out, edges, hub } = await st.cache.get(key);
    draw(out, edges, hub);
    applyView();
  }
  async function compute() {
    $('#msg').style.display = '';
    const vis = M.tables.filter(visible);
    const visIds = new Set(vis.map((t) => t.id));
    const area = areaMode();
    // 영역 배치는 위 → 아래(부모 → 자식)라 테이블 단위로 잇는다. 그 밖에는 컬럼 높이에서 잇는다
    const ports = (t) => {
      if (area) return [];
      const w = width(t);
      return shownCols(t).flatMap((c, i) => {
        const y = HEAD + i * ROW + ROW / 2;
        return [{ id: `${t.id}#${c.name}#e`, x: w, y, width: 0, height: 0 }, { id: `${t.id}#${c.name}#w`, x: 0, y, width: 0, height: 0 }];
      });
    };
    const portOf = (tid, col, side) => (!area && shownCols(byId.get(tid)).some((c) => c.name === col) ? `${tid}#${col}#${side}` : tid);
    const node = (t) => ({ id: t.id, width: width(t), height: height(t), ports: ports(t), ...(area ? {} : { layoutOptions: { 'elk.portConstraints': 'FIXED_POS' } }) });
    // 배치 옵션: 층마다 테이블 수에 상한을 둔다. 많이 참조되는 테이블(종목 · 사용자 · 코드)이 있으면 자식이 한 층에 몰려 길어지기 때문 (Coffman-Graham)
    const opts = (kids, down) => ({
      'elk.algorithm': 'layered', 'elk.direction': down ? 'DOWN' : 'RIGHT', 'elk.edgeRouting': 'ORTHOGONAL',
      // 여유 있는 간격: 테이블 사이 · 층 사이 · 선과 테이블 사이
      // [테이블] 수준은 글자를 키운 만큼 간격도 조금 넓힌다 (제곱근 비율: 줄여 보면 여전히 촘촘해진다)
      ...(() => { const c = st.level === 'concept'; const g = c ? Math.sqrt(cs()) : 1; const v = (a, b) => String(Math.round((c ? a : b) * g)); return {
        'elk.layered.spacing.nodeNodeBetweenLayers': v(down ? 44 : 60, down ? 60 : 110), 'elk.spacing.nodeNode': v(24, down ? 36 : 48), 'elk.spacing.edgeNode': v(14, 28), 'elk.spacing.edgeEdge': v(7, 14),
        'elk.layered.spacing.edgeNodeBetweenLayers': v(14, 28), 'elk.layered.spacing.edgeEdgeBetweenLayers': v(7, 14), 'elk.spacing.componentComponent': v(down ? 36 : 80, down ? 48 : 80) }; })(),
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP', 'elk.layered.thoroughness': '30',
      'elk.separateConnectedComponents': 'true', 'elk.aspectRatio': down ? '1.4' : '1.6',
      ...(kids.length > 12 ? { 'elk.layered.layering.strategy': 'COFFMAN_GRAHAM', 'elk.layered.layering.coffmanGraham.layerBound': String(layerBound(kids, down)) } : {}),
    });
    // 층마다 상한: 층 수 L 이면 층 방향 길이 ≈ L × (카드 + 층 간격), 다른 방향 ≈ (n / L) × (카드 + 간격). 목표 비율이 되는 L 에서 상한 = n / L
    const layerBound = (kids, down) => {
      const n = kids.length;
      const w = kids.reduce((x, t) => x + width(t), 0) / n + (down ? 36 : 110);
      const h = kids.reduce((x, t) => x + height(t), 0) / n + (down ? 60 : 48);
      // 목표 비율은 재 보며 정했다(124표 견본: 가로:세로 약 1.45). 묶기 없는 [컬럼] 수준은 포트가 많아 계산이 오래 걸려(목표 3 이면 3초) 낮춘다
      const L = down ? Math.sqrt((n * w) / (1.4 * h)) : Math.sqrt(((st.level === 'full' && st.arrange === 'rel' ? 1.6 : 3) * n * h) / w);
      return Math.max(3, Math.ceil(n / Math.max(1, L)));
    };
    // 숨길 선(허브 · 코드 표로 가는 선)은 배치에서 빼고, 그 표를 고를 때만 꺾은선으로 보인다 (hub)
    const bothVis = rels.filter((r) => visIds.has(r.from) && visIds.has(r.to));
    const visRels = bothVis.filter((r) => !hubRel(r));
    const hub = bothVis.filter(hubRel);
    const edge = (r, i) => ({ id: `e${i}`, sources: [portOf(r.from, r.fromCol, 'e')], targets: [portOf(r.to, r.toCol, 'w')], rel: r });
    const ix = visRels.map((r, i) => [r, i]);
    const schemaOf = (id) => byId.get(id).schema;
    const pack = (extra) => ({ 'elk.algorithm': 'rectpacking', 'elk.aspectRatio': String(aspect()), 'elk.hierarchyHandling': 'SEPARATE_CHILDREN', ...extra });
    let graph;
    if (area && st.overview) {
      // 영역 개요: 덩어리 하나 = 카드 하나. 스키마 상자 안에 카드를 바둑판으로
      graph = { id: 'root', layoutOptions: pack({ 'elk.spacing.nodeNode': '60' }), edges: [], children: chunks(vis).map(({ s, areas }) => ({
        id: `g:${s}`, layoutOptions: pack({ 'elk.spacing.nodeNode': '28', 'elk.padding': '[top=56,left=26,bottom=26,right=26]' }), edges: [],
        children: areas.map(({ a, key, kids }) => ({ id: `c:${key}`, ...cardSize(a, kids) })),
      })) };
    } else if (area) {
      // 영역 배치: 스키마 상자 → 영역 덩어리(바둑판) → 덩어리 안은 부모 → 자식 위에서 아래로. 덩어리 사이 선은 배치에 넣지 않는다
      const pad = Math.round(areaFont() * 1.6 + 22);
      graph = { id: 'root', layoutOptions: pack({ 'elk.spacing.nodeNode': '80' }), edges: [], children: chunks(vis).map(({ s, areas }) => ({
        id: `g:${s}`, layoutOptions: pack({ 'elk.spacing.nodeNode': '40', 'elk.padding': `[top=${pad + 16},left=26,bottom=26,right=26]` }), edges: [],
        children: areas.map(({ key, kids }) => {
          const ids = new Set(kids.map((t) => t.id));
          return { id: `a:${key}`, layoutOptions: { ...opts(kids, true), 'elk.padding': `[top=${pad},left=22,bottom=22,right=22]` }, children: kids.map(node), edges: ix.filter(([r]) => ids.has(r.from) && ids.has(r.to)).map(([r, i]) => edge(r, i)) };
        }),
      })) };
    } else if (st.arrange === 'schema') {
      // 스키마 묶기: 스키마마다 따로 배치해 상자로 나란히 놓는다. 스키마 사이 관계선은 draw 가 직접 잇는다
      graph = { id: 'root', layoutOptions: { 'elk.algorithm': 'rectpacking', 'elk.aspectRatio': '1.6', 'elk.spacing.nodeNode': '80', 'elk.hierarchyHandling': 'SEPARATE_CHILDREN' }, edges: [], children: M.schemas.filter((s) => !st.hidden.has(s)).map((s) => {
        const kids = vis.filter((t) => t.schema === s);
        return { id: `g:${s}`, layoutOptions: { ...opts(kids), 'elk.padding': '[top=44,left=26,bottom=26,right=26]' }, children: kids.map(node), edges: ix.filter(([r]) => schemaOf(r.from) === s && schemaOf(r.to) === s).map(([r, i]) => edge(r, i)) };
      }) };
    } else {
      // 관계 중심(기본, 영역이 없을 때): 묶음 없이 배치해 관계있는 테이블이 붙는다
      graph = { id: 'root', layoutOptions: { ...opts(vis), 'elk.spacing.componentComponent': '80', 'elk.hierarchyHandling': 'INCLUDE_CHILDREN' }, children: vis.map(node), edges: visRels.map(edge) };
    }
    const edges = [];
    const collect = (n) => { edges.push(...(n.edges || [])); for (const c of n.children || []) collect(c); };
    collect(graph);
    const out = await new ELK().layout(graph);
    $('#msg').style.display = 'none';
    return { out, edges, hub };
  }

  function draw(g, edgeDefs, hub = []) {
    vp.replaceChildren();
    st.pos.clear();
    st.boxes = new Map();
    st.W = g.width; st.H = g.height;
    const gl = el('g'); const el2 = el('g'); const tl = el('g'); const top = el('g');
    vp.append(gl, el2, tl, top); // top: 요약선 개수 (카드 · 표 위에)
    // ELK 결과는 부모 기준 좌표다: 절대 좌표로 펴면서 스키마 상자(g:) · 영역 덩어리(a:) · 영역 카드(c:) · 테이블로 나눈다
    const groups = []; const nodes = []; const cards = []; const laid = [];
    const walk = (n, ox, oy) => {
      for (const c of n.children || []) {
        const a = { ...c, x: ox + c.x, y: oy + c.y };
        if (c.id.startsWith('g:')) { groups.push({ ...a, kind: 'schema', schema: c.id.slice(2) }); walk(c, a.x, a.y); }
        else if (c.id.startsWith('a:')) { groups.push({ ...a, kind: 'area', key: c.id.slice(2), schema: splitKey(c.id.slice(2))[0] }); walk(c, a.x, a.y); }
        else if (c.id.startsWith('c:')) cards.push({ ...a, key: c.id.slice(2), schema: splitKey(c.id.slice(2))[0] });
        else nodes.push(a);
      }
      for (const e of n.edges || []) laid.push([e, { x: ox, y: oy }]);
    };
    walk(g, 0, 0);
    const visT = (key) => M.tables.filter((t) => visible(t) && chunkOf(t) === key);
    for (const grp of groups) {
      const c = color(grp.schema);
      if (grp.kind === 'schema') {
        const gg = el('g', { class: 'grp', 'data-schema': grp.schema });
        gg.append(el('rect', { x: grp.x, y: grp.y, width: grp.width, height: grp.height, rx: 10, stroke: c }));
        const f = !areaMode() ? 13 : st.overview ? 16 : Math.max(13, areaFont() * 0.85);
        gg.append(el('text', { x: grp.x + 16, y: grp.y + f + 12, fill: c, style: `font-size:${f}px` }, `${grp.schema} 스키마 · ${M.tables.filter((t) => t.schema === grp.schema && visible(t)).length}`));
        gl.append(gg);
      } else {
        // 영역 덩어리: 제목을 누르면 그 덩어리에 맞춘다
        st.boxes.set(grp.key, grp);
        const kids = visT(grp.key);
        const f = areaFont();
        const gg = el('g', { class: 'agrp', 'data-key': grp.key });
        gg.append(el('rect', { x: grp.x, y: grp.y, width: grp.width, height: grp.height, rx: 8, stroke: c }));
        const tx = el('text', { class: 'at', x: grp.x + 14, y: grp.y + f + 8, fill: c, style: `font-size:${f}px` }, areaName(splitKey(grp.key)[1]));
        tx.append(el('tspan', { class: 'an', dx: f * 0.5, style: `font-size:${f * 0.7}px` }, `테이블 ${kids.length}`));
        tx.append(el('title', {}, '누르면 이 영역에 맞춘다'));
        tx.addEventListener('click', (ev) => { ev.stopPropagation(); fitTables(kids.map((t) => t.id), grp.key); });
        gg.append(tx);
        gl.append(gg);
      }
    }
    // 영역 개요 카드: 누르면 영역 배치로 바꿔 그 덩어리로 확대
    for (const cd of cards) {
      st.boxes.set(cd.key, cd);
      const [s, a] = splitKey(cd.key);
      const kids = visT(cd.key);
      const ids = new Set(kids.map((t) => t.id));
      const fk = rels.filter((r) => ids.has(r.from) && ids.has(r.to)).length;
      const lg = lrels.filter((r) => ids.has(r.from) || ids.has(r.to)).length;
      const cg = el('g', { class: 'card', 'data-key': cd.key, transform: `translate(${cd.x},${cd.y})` });
      cg.append(el('rect', { class: 'box', width: cd.width, height: cd.height, rx: 10 }));
      cg.append(el('path', { class: 'hd', d: `M0 10 a10 10 0 0 1 10 -10 h${cd.width - 20} a10 10 0 0 1 10 10 v44 h${-cd.width} z`, fill: color(s) }));
      cg.append(el('text', { class: 'cn0', x: 16, y: 36, style: `font-size:${CARD_F}px` }, areaName(a)));
      cg.append(el('text', { class: 'cs', x: 16, y: 54 + 22 }, `테이블 ${kids.length} · FK ${fk}${lrels.length ? ` · 논리 참조 ${lg}` : ''}`));
      const rep = repOf(kids);
      rep.slice(0, cardRows).forEach((t, i) => {
        const tx = el('text', { class: 'cr', x: 16, y: 54 + 28 + 18 + i * 21 }, `· ${t.logical || t.name}`);
        if (i === cardRows - 1 && rep.length > cardRows) tx.append(el('tspan', { class: 'cm', dx: 8 }, `외 ${rep.length - cardRows}`));
        cg.append(tx);
      });
      cg.append(el('title', {}, `${s} · ${areaName(a)}: ${kids.map((t) => t.logical || t.name).join(', ')}\n누르면 이 영역으로 확대`));
      cg.addEventListener('click', (ev) => { ev.stopPropagation(); goArea(cd.key); });
      tl.append(cg);
    }
    for (const n of nodes) {
      const t = byId.get(n.id);
      st.pos.set(t.id, n);
      const tg = el('g', { class: 'tb', 'data-id': t.id, transform: `translate(${n.x},${n.y})` });
      tg.append(el('rect', { class: 'box', width: n.width, height: n.height, rx: 6 }));
      const hh = st.level === 'concept' ? CH() : HEAD;
      tg.append(el('path', { class: 'hd', d: `M0 6 a6 6 0 0 1 6 -6 h${n.width - 12} a6 6 0 0 1 6 6 v${hh - 6} h${-n.width} z`, fill: color(t.schema) }));
      {
        const [a, b] = label(t.logical, t.name);
        const big = st.level === 'concept';
        const tx = el('text', { class: big ? 'tn big' : 'tn', x: big ? 14 * cs() : 10, y: big ? 37 * cs() : 18, ...(big ? { style: `font-size:${st.cf}px` } : {}) }, a);
        if (b) tx.append(el('tspan', { class: 'tp', dx: big ? 7 * cs() : 7, ...(big ? { style: `font-size:${st.cf * 0.7}px` } : {}) }, b));
        tg.append(tx);
      }
      const sc = shownCols(t);
      sc.forEach((c, i) => {
        const y = HEAD + i * ROW + 13;
        let x = 8;
        for (const [k, on] of [['PK', c.pk], ['FK', c.fk], ['UK', c.uk]]) if (on) {
          tg.append(el('rect', { x, y: y - 9, width: 17, height: 11, rx: 2, fill: css(`--${k.toLowerCase()}`) }));
          tg.append(el('text', { class: 'kb', x: x + 2, y: y - 0.5 }, k));
          x += 19;
        }
        const [a, b] = label(c.logical, c.name);
        const cx = el('text', { class: 'cn', x: Math.max(x + 2, 46), y }, a);
        if (b) cx.append(el('tspan', { class: 'cp', dx: 6 }, b));
        tg.append(cx);
        tg.append(el('text', { class: 'ct', x: n.width - 8, y, 'text-anchor': 'end' }, c.type + (c.nullable ? '?' : '')));
      });
      if (st.level === 'concept') {
        const nrel = rels.filter((r) => r.from === t.id || r.to === t.id).length;
        tg.append(el('text', { class: 'more big', x: 14 * cs(), y: CH() + 24 * cs(), style: `font-size:${st.cf * 0.67}px` }, `컬럼 ${t.columns.length} · 관계 ${nrel}`));
      } else if (!sc.length) tg.append(el('text', { class: 'more', x: 10, y: HEAD + 13 }, '키 컬럼 없음'));
      const rest = t.columns.length - sc.length;
      if (rest > 0 && st.level === 'compact') tg.append(el('text', { class: 'more', x: 10, y: HEAD + sc.length * ROW + 13 }, `+ 컬럼 ${rest}개 (확대하면 모두)`));
      const out = outside(t);
      if (out.length) {
        const big = st.level === 'concept';
        const lab = el('text', { class: big ? 'more out big' : 'more out', x: big ? 14 * cs() : 10, y: n.height - (big ? 8 * cs() : 5), ...(big ? { style: `font-size:${st.cf * 0.6}px` } : {}) }, `→ 영역 밖: ${out.slice(0, 3).join(' · ')}${out.length > 3 ? ` 외 ${out.length - 3}` : ''}`);
        lab.append(el('title', {}, `영역 밖 관계: ${out.join(', ')}`));
        tg.append(lab);
      }
      tg.addEventListener('click', (ev) => { ev.stopPropagation(); select(t.id); });
      tg.addEventListener('mouseenter', () => peekShow(t.id));
      tg.addEventListener('mouseleave', peekHide);
      tl.append(tg);
    }
    st.edges = [];
    const addEdge = (pts, r, extra = '') => {
      const p = el('path', { class: `ed${extra}`, d: `M${pts.map((q) => `${q.x} ${q.y}`).join(' L')}`, 'marker-start': 'url(#one)', 'marker-end': 'url(#many)' });
      if (r.nullable) p.setAttribute('stroke-dasharray', '5 3');
      p.append(el('title', {}, `${r.from}${r.fromCol ? `.${r.fromCol}` : ''} 1 ─ N ${r.to}.${r.toCol}${r.nullable ? ' (선택)' : ''}${r.logical ? ' · 논리 참조 (DB 외래키 없음)' : extra === ' x' ? ' · 스키마 사이' : extra === ' hub' ? ' · 숨긴 선 (참조 많은 표)' : ''}`));
      el2.append(p);
      st.edges.push({ p, r });
    };
    const defs = new Map(edgeDefs.map((d) => [d.id, d.rel]));
    for (const [e, o] of laid) {
      const r = defs.get(e.id);
      if (r) for (const sec of e.sections || []) addEdge([sec.startPoint, ...(sec.bendPoints || []), sec.endPoint].map((q) => ({ x: q.x + o.x, y: q.y + o.y })), r);
    }
    // 배치에 넣지 않은 선: 부모 오른쪽(그 컬럼 높이) → 자식 왼쪽으로 꺾은선. 상자 사이 빈 곳으로 돌아간다
    const portY = (tid, col) => { const n = st.pos.get(tid); const i = areaMode() ? -1 : shownCols(byId.get(tid)).findIndex((c) => c.name === col); return n.y + (i >= 0 ? HEAD + i * ROW + ROW / 2 : n.height / 2); };
    const route = (r, cls) => {
      const a = st.pos.get(r.from); const b = st.pos.get(r.to);
      if (!a || !b || r.from === r.to) return;
      const s0 = { x: a.x + a.width, y: portY(r.from, r.fromCol) };
      const t0 = { x: b.x, y: portY(r.to, r.toCol) };
      const pts = t0.x > s0.x + 40
        ? [s0, { x: (s0.x + t0.x) / 2, y: s0.y }, { x: (s0.x + t0.x) / 2, y: t0.y }, t0]
        : [s0, { x: s0.x + 24, y: s0.y }, { x: s0.x + 24, y: (s0.y + t0.y) / 2 }, { x: t0.x - 24, y: (s0.y + t0.y) / 2 }, { x: t0.x - 24, y: t0.y }, t0];
      addEdge(pts, r, cls);
    };
    const shown = (r) => st.pos.has(r.from) && st.pos.has(r.to);
    const area = areaMode();
    // 스키마 묶기: 스키마 사이 관계 · 숨긴 선(허브) · 논리 참조(켰을 때). 영역 배치에서는 같은 덩어리 안만 하나씩, 덩어리 사이는 요약선
    const sameChunk = (r) => chunkOf(byId.get(r.from)) === chunkOf(byId.get(r.to));
    if (st.arrange === 'schema' && !area) for (const r of rels.filter((x) => shown(x) && !hubRel(x) && byId.get(x.from).schema !== byId.get(x.to).schema)) route(r, ' x');
    for (const r of hub) if (!area || sameChunk(r)) route(r, ' hub');
    if (st.lrefs) for (const r of lrels.filter(shown)) if (!area || sameChunk(r)) route(r, ' lg');
    // 덩어리 사이 요약선: 덩어리 → 덩어리 하나에 개수 (FK 는 「영역 사이 선」, 논리 참조는 「논리 참조」 를 켰을 때)
    if (area) {
      const vis = (id) => visible(byId.get(id));
      const pairs = new Map();
      const add = (r, k) => {
        if (!vis(r.from) || !vis(r.to)) return;
        const a = chunkOf(byId.get(r.from)); const b = chunkOf(byId.get(r.to));
        if (a === b) return;
        const key = a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
        const p = pairs.get(key) || { a: a < b ? a : b, b: a < b ? b : a, fk: 0, lg: 0 };
        p[k]++; pairs.set(key, p);
      };
      if (st.xarea) for (const r of rels) add(r, 'fk');
      if (st.lrefs) for (const r of lrels) add(r, 'lg');
      const clip = (bx, tx, ty) => { const cx = bx.x + bx.width / 2; const cy = bx.y + bx.height / 2; const dx = tx - cx; const dy = ty - cy; const k = Math.min(Math.abs(bx.width / 2 / (dx || 1e-9)), Math.abs(bx.height / 2 / (dy || 1e-9))); return { x: cx + dx * k, y: cy + dy * k }; };
      const f = st.overview ? 15 : Math.max(13, areaFont() * 0.8);
      for (const p of pairs.values()) {
        const A = st.boxes.get(p.a); const B = st.boxes.get(p.b);
        if (!A || !B) continue;
        const s0 = clip(A, B.x + B.width / 2, B.y + B.height / 2);
        const t0 = clip(B, A.x + A.width / 2, A.y + A.height / 2);
        const txt = [p.fk ? `FK ${p.fk}` : '', p.lg ? `논리 ${p.lg}` : ''].filter(Boolean).join(' · ');
        const line = el('path', { class: `sum${p.fk ? '' : ' lg'}`, d: `M${s0.x} ${s0.y} L${t0.x} ${t0.y}`, style: `stroke-width:${Math.min(8, 1.5 + Math.sqrt(p.fk + p.lg))}px` });
        line.append(el('title', {}, `${p.a.replace('/', ' · ')} ↔ ${p.b.replace('/', ' · ')}: ${txt}`));
        el2.append(line);
        top.append(el('text', { class: 'sumt', x: (s0.x + t0.x) / 2, y: (s0.y + t0.y) / 2 + f / 3, 'text-anchor': 'middle', style: `font-size:${f}px` }, txt));
      }
    }
    drawMini(groups, nodes, cards);
    applyView();
    paint();
  }

  // 미니맵: 전체 배치를 줄여 그리고(테이블 = 스키마 색) 지금 보이는 영역을 사각형으로. 누르거나 끌면 그 자리를 가운데로
  const mini = $('#mini');
  const msvg = $('#minisvg');
  const MW = 200;
  const MH = 140;
  let ms = 1;
  function drawMini(groups, nodes, cards = []) {
    if (!mini) return;
    ms = Math.min(MW / (st.W || 1), MH / (st.H || 1));
    msvg.setAttribute('width', Math.max(40, st.W * ms));
    msvg.setAttribute('height', Math.max(30, st.H * ms));
    const mg = $('#minig');
    mg.replaceChildren();
    for (const grp of groups) mg.append(el('rect', { class: grp.kind === 'area' ? 'mg ma' : 'mg', x: grp.x * ms, y: grp.y * ms, width: grp.width * ms, height: grp.height * ms, stroke: color(grp.schema) }));
    for (const n of [...nodes, ...cards]) mg.append(el('rect', { x: n.x * ms, y: n.y * ms, width: Math.max(1.5, n.width * ms), height: Math.max(1.5, n.height * ms), fill: color(n.schema || byId.get(n.id).schema) }));
  }
  function miniView() {
    if (!mini) return;
    const b = stage.getBoundingClientRect();
    const v = $('#miniView');
    v.setAttribute('x', (-st.x / st.k) * ms);
    v.setAttribute('y', (-st.y / st.k) * ms);
    v.setAttribute('width', Math.max(2, (b.width / st.k) * ms));
    v.setAttribute('height', Math.max(2, (b.height / st.k) * ms));
  }
  if (mini) {
    const miniKey = 'erd.mini';
    const setMini = (on) => { mini.classList.toggle('off', !on); $('#miniBtn').textContent = on ? '미니맵 ▾' : '미니맵 ▸'; $('#miniBtn').setAttribute('aria-expanded', String(on)); };
    try { setMini(localStorage.getItem(miniKey) !== 'off'); } catch (e) { setMini(true); }
    $('#miniBtn').addEventListener('click', () => { const on = mini.classList.contains('off'); setMini(on); try { localStorage.setItem(miniKey, on ? 'on' : 'off'); } catch (e) { /* 기억 못 해도 바뀐다 */ } });
    // 캔버스 끌기 · 확대 · 선택 해제로 번지지 않게
    for (const ev of ['pointerdown', 'click']) mini.addEventListener(ev, (e) => e.stopPropagation());
    mini.addEventListener('wheel', (e) => { e.preventDefault(); e.stopPropagation(); }, { passive: false });
    let md = false;
    const goMini = (e) => {
      const r = msvg.getBoundingClientRect();
      const b = stage.getBoundingClientRect();
      const wx = (e.clientX - r.left) / ms;
      const wy = (e.clientY - r.top) / ms;
      st.x = b.width / 2 - wx * st.k;
      st.y = b.height / 2 - wy * st.k;
      applyView();
    };
    msvg.addEventListener('pointerdown', (e) => { md = true; peekHide(); msvg.setPointerCapture(e.pointerId); goMini(e); });
    msvg.addEventListener('pointermove', (e) => { if (md) goMini(e); });
    msvg.addEventListener('pointerup', () => { md = false; });
  }

  // 돋보기: 축소해서 글자가 작을 때 카드에 마우스를 올리면 읽기 좋은 크기로 띄운다
  const peek = document.createElement('div');
  peek.id = 'peek';
  stage.append(peek);
  let peekT = null;
  function peekShow(id) {
    clearTimeout(peekT);
    if (st.k >= 0.95 || drag) return; // 충분히 크면 띄우지 않는다
    peekT = setTimeout(() => {
      const t = byId.get(id);
      const n = st.pos.get(id);
      if (!t || !n) return;
      const cols = t.columns; // 돋보기는 늘 전체 컬럼
      const kb = (c) => [['pk', c.pk], ['fk', c.fk], ['uk', c.uk]].filter((x) => x[1]).map(([k]) => `<i class="k ${k}">${k.toUpperCase()}</i>`).join('');
      const nm = (l, p2) => { const [a, b] = label(l, p2); return `${esc(a)}${b ? ` <span class="pp">${esc(b)}</span>` : ''}`; };
      const nrel = rels.filter((r) => r.from === id || r.to === id).length;
      peek.innerHTML = `<div class="ph" style="background:${color(t.schema)}">${nm(t.logical, t.name)}</div>
        <table>${cols.map((c) => `<tr><td class="kk">${kb(c)}</td><td>${nm(c.logical, c.name)}</td><td class="ty">${esc(c.type)}${c.nullable ? '?' : ''}</td></tr>`).join('')}</table>
        <div class="pf">${t.columns.length > cols.length ? `+ 컬럼 ${t.columns.length - cols.length}개 · ` : ''}관계 ${nrel} · ${esc(t.schema)}</div>`;
      peek.style.display = 'block';
      const b = stage.getBoundingClientRect();
      const r = { x: st.x + n.x * st.k, y: st.y + n.y * st.k, w: n.width * st.k };
      const pw = peek.offsetWidth;
      const ph = peek.offsetHeight;
      let x = r.x + r.w + 12;
      if (x + pw > b.width - 8) x = Math.max(8, r.x - pw - 12);
      const y = Math.min(Math.max(8, r.y - 4), b.height - ph - 8);
      peek.style.left = `${x}px`;
      peek.style.top = `${y}px`;
    }, 120);
  }
  function peekHide() { clearTimeout(peekT); peek.style.display = 'none'; }

  // 화면 이동 · 확대
  function applyView() {
    vp.setAttribute('transform', `translate(${st.x},${st.y}) scale(${st.k})`);
    const lv = $('#lv');
    if (lv) lv.textContent = st.overview && areaMode() ? '영역 개요: 카드를 누르면 그 영역으로' : `표시 수준: ${LEVEL_NAME[st.level]}${st.mode === 'auto' ? ' (자동)' : ''}`;
    const zl = $('#zoom');
    if (zl) zl.textContent = `${Math.round(st.k * 100)}%`;
    miniView();
  }
  function fitK() {
    const b = stage.getBoundingClientRect();
    const pad = 30;
    st.k = Math.min(2, (b.width - pad * 2) / st.W, (b.height - pad * 2) / st.H);
    st.x = (b.width - st.W * st.k) / 2;
    st.y = (b.height - st.H * st.k) / 2;
    applyView();
  }
  // [테이블] 수준 글자 크기: 화면에서 약 15px 로 보이게 (24px 아래로는 줄이지 않는다, 1.25 배 단위로 바꿔 배치 계산을 아낀다)
  const cfFor = (k) => { const raw = Math.min(480, Math.max(24, 15 / k)); return Math.round(24 * 1.25 ** Math.round(Math.log(raw / 24) / Math.log(1.25))); };
  // 맞춤: 글자를 키우면 카드도 커져 맞춤 비율이 같이 줄어든다. 화면 글자가 15% 이상 커질 때만 키운다 (못 키우면 돋보기로 읽는다)
  async function fitConcept() {
    for (let i = 0; i < 5 && st.level === 'concept'; i++) {
      const want = cfFor(st.k);
      if (want <= st.cf) break;
      const prev = st.cf;
      const px = st.cf * st.k;
      st.cf = want; await layout(); fitK();
      if (st.cf * st.k < px * 1.15) { st.cf = prev; await layout(); fitK(); break; }
    }
  }
  // 맞춤: 자동이면 맞춘 비율에 맞는 단계로 바꾸고 다시 맞춘다
  async function fit(stay) {
    if (st.overview && areaMode()) { fitK(); return; }
    if (st.mode !== 'auto') { fitK(); await fitConcept(); return; }
    // 영역 배치 전체가 한 화면에서 영역 이름을 읽을 수 없을 만큼 작아지면 영역 개요로 보인다 (카드를 누르면 그 영역으로)
    if (!stay && areaMode() && new Set(M.tables.filter(visible).map(chunkOf)).size > 1) {
      if (st.level !== 'concept') { st.level = 'concept'; st.cf = 24; await layout(); }
      fitK();
      if (st.k * areaFont() < 11) { st.overview = true; syncTools(); await layout(); fitK(); return; }
    }
    // 키 수준으로 맞춰 보고, 너무 작으면 테이블, 넉넉하면 컬럼으로
    if (st.level !== 'compact') { st.level = 'compact'; await layout(); }
    fitK();
    const want = levelFor(st.k);
    if (want !== st.level) { st.level = want; if (want === 'concept') st.cf = cfFor(st.k); await layout(); fitK(); }
    await fitConcept();
  }
  // 다시 배치할 때(표시 수준 · 글자 크기) 화면 한 점(확대 중심) 가까이 있던 테이블이 같은 자리에 남게 한다
  async function relayoutAt(change, cx, cy) {
    if (st.switching) return;
    st.switching = true;
    const wx = (cx - st.x) / st.k;
    const wy = (cy - st.y) / st.k;
    let anchor = null;
    let best = Infinity;
    for (const [id, n] of st.pos) {
      const d = Math.hypot(n.x + n.width / 2 - wx, n.y + n.height / 2 - wy);
      if (d < best) { best = d; anchor = id; }
    }
    const a0 = anchor && st.pos.get(anchor);
    const sx = a0 ? st.x + (a0.x + a0.width / 2) * st.k : 0;
    const sy = a0 ? st.y + a0.y * st.k : 0;
    change();
    try { await layout(); } finally { st.switching = false; }
    const a1 = anchor && st.pos.get(anchor);
    if (a1) { st.x = sx - (a1.x + a1.width / 2) * st.k; st.y = sy - a1.y * st.k; applyView(); }
  }
  const switchLevel = (level, cx, cy) => (level === st.level ? Promise.resolve() : relayoutAt(() => { st.level = level; if (level === 'concept') st.cf = cfFor(st.k); }, cx, cy));
  let zt = null;
  function zoomAt(f, cx, cy) {
    const k = Math.min(3, Math.max(0.03, st.k * f));
    st.x = cx - ((cx - st.x) * k) / st.k;
    st.y = cy - ((cy - st.y) * k) / st.k;
    st.k = k;
    applyView();
    clearTimeout(zt);
    zt = setTimeout(async () => {
      if (st.overview && areaMode()) return; // 영역 개요는 카드만 그린다 (표시 수준이 없다)
      // 한 번에 여러 단계를 건너뛸 수 있게 안정될 때까지 반복한다
      if (st.mode === 'auto') for (let i = 0; i < 3; i++) { const want = levelFor(st.k, st.level); if (want === st.level) break; await switchLevel(want, cx, cy); }
      if (st.level === 'concept' && cfFor(st.k) !== st.cf) await relayoutAt(() => { st.cf = cfFor(st.k); }, cx, cy);
    }, 120);
  }
  function centerOn(id) {
    const n = st.pos.get(id);
    if (!n) return;
    const b = stage.getBoundingClientRect();
    st.k = Math.max(st.k, 0.9);
    const dw = st.sel ? Math.min($('#detail').offsetWidth || 0, b.width * 0.6) : 0; // 드로어가 가리는 오른쪽을 빼고 가운데
    st.x = (b.width - dw) / 2 - (n.x + n.width / 2) * st.k;
    st.y = b.height / 2 - (n.y + n.height / 2) * st.k;
    applyView();
    if (st.mode === 'auto') { const want = levelFor(st.k, st.level); if (want !== st.level) switchLevel(want, b.width / 2, b.height / 2).then(() => centerOn(id)); }
  }
  // 테이블 묶음(스키마) 영역에 맞춘다. 자동이면 맞춘 비율에 맞는 단계로 바꾸고 다시 맞춘다
  async function fitTables(ids, key) {
    const box = () => {
      // 영역 덩어리면 제목까지 들어가게 덩어리 상자에 맞춘다
      const ns = key && st.boxes && st.boxes.has(key) ? [st.boxes.get(key)] : ids.map((id) => st.pos.get(id)).filter(Boolean);
      if (!ns.length) return false;
      const x0 = Math.min(...ns.map((n) => n.x)); const y0 = Math.min(...ns.map((n) => n.y));
      const x1 = Math.max(...ns.map((n) => n.x + n.width)); const y1 = Math.max(...ns.map((n) => n.y + n.height));
      const b = stage.getBoundingClientRect();
      const pad = 40;
      const top = 64; // 위쪽 조작 막대에 가리지 않게
      st.k = Math.min(1.2, (b.width - pad * 2) / (x1 - x0), (b.height - pad - top) / (y1 - y0)); // 전체 맞춤처럼 하한 없이 (하한에 걸리면 글자 키우기 판정이 틀어진다)
      st.x = b.width / 2 - ((x0 + x1) / 2) * st.k;
      st.y = top + (b.height - pad - top) / 2 - ((y0 + y1) / 2) * st.k;
      applyView();
      return true;
    };
    // 단계 · 글자 크기가 바뀌면 다시 배치되어 자리가 달라지므로, 바뀔 때마다 다시 맞춘다 (전체 맞춤 fit · fitConcept 와 같은 규칙)
    if (st.level === 'concept' && st.cf !== 24) { st.cf = 24; await layout(); }
    if (!box()) return;
    for (let i = 0; i < 3 && st.mode === 'auto'; i++) {
      const want = levelFor(st.k, st.level);
      if (want === st.level) break;
      st.level = want;
      if (want === 'concept') st.cf = 24;
      await layout(); box();
    }
    // [테이블] 수준: 글자를 키우면 카드도 커진다. 화면 글자가 15% 이상 커질 때만 키운다
    for (let i = 0; i < 5 && st.level === 'concept'; i++) {
      const want = cfFor(st.k);
      if (want <= st.cf) break;
      const prev = st.cf;
      const px = st.cf * st.k;
      st.cf = want; await layout(); box();
      if (st.cf * st.k < px * 1.15) { st.cf = prev; await layout(); box(); break; }
    }
  }
  stage.addEventListener('wheel', (e) => { e.preventDefault(); peekHide(); const b = stage.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - b.left, e.clientY - b.top); }, { passive: false });
  let drag = null;
  stage.addEventListener('pointerdown', (e) => { if (e.target.closest('.tb')) return; drag = { x: e.clientX, y: e.clientY, sx: st.x, sy: st.y, moved: false }; stage.classList.add('drag'); });
  window.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x; const dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true; st.x = drag.sx + dx; st.y = drag.sy + dy; applyView(); });
  window.addEventListener('pointerup', () => { if (drag && !drag.moved) select(null); drag = null; stage.classList.remove('drag'); });

  // 선택 · 검색 강조
  function neighbors(id) {
    const s = new Set([id]);
    for (const r of allRels()) { if (r.from === id) s.add(r.to); if (r.to === id) s.add(r.from); }
    return s;
  }
  function matches() {
    const q = st.q.toLowerCase();
    if (!q) return null;
    return new Set(M.tables.filter((t) => t.id.toLowerCase().includes(q) || (t.logical || '').toLowerCase().includes(q) || t.desc.toLowerCase().includes(q) || t.columns.some((c) => c.name.toLowerCase().includes(q) || (c.logical || '').toLowerCase().includes(q))).map((t) => t.id));
  }
  function paint() {
    const near = st.sel ? neighbors(st.sel) : null;
    const hit = matches();
    for (const g of vp.querySelectorAll('.tb')) {
      const id = g.dataset.id;
      g.classList.toggle('sel', id === st.sel);
      g.classList.toggle('hit', !!hit && hit.has(id) && id !== st.sel);
      g.classList.toggle('dim', (near && !near.has(id)) || (!near && hit && !hit.has(id)));
    }
    // 영역 개요: 검색에 맞는 표가 든 카드를 강조
    for (const g of vp.querySelectorAll('.card')) {
      const on = !!hit && M.tables.some((t) => hit.has(t.id) && chunkOf(t) === g.dataset.key);
      g.classList.toggle('hit', on);
      g.classList.toggle('dim', !!hit && !on);
    }
    for (const { p, r } of st.edges) {
      const on = st.sel && (r.from === st.sel || r.to === st.sel);
      p.classList.toggle('on', !!on);
      p.classList.toggle('dim', !!(st.sel && !on) || (!st.sel && hit && !(hit.has(r.from) && hit.has(r.to))));
      if (on) p.parentNode.append(p);
    }
    // 접힌 스키마라도 검색에 맞는 표 · 선택한 표가 있으면 펼쳐 보인다
    // 접기 단위: 스키마(키 = 스키마) · 그 안의 영역(키 = 스키마/영역)
    const open = new Set([...(hit || [])].flatMap((id) => { const t = byId.get(id); return [t.schema, `${t.schema}/${t.listArea}`]; }));
    if (st.sel) { const t = byId.get(st.sel); open.add(t.schema); open.add(`${t.schema}/${t.listArea}`); }
    const folded = (k) => st.fold.has(k) && !open.has(k);
    for (const a of document.querySelectorAll('#list a')) {
      const t = byId.get(a.dataset.id);
      a.classList.toggle('on', a.dataset.id === st.sel);
      a.classList.toggle('dim', !!hit && !hit.has(a.dataset.id));
      a.classList.toggle('folded', folded(t.schema) || (AREAS.length > 0 && folded(`${t.schema}/${t.listArea}`)));
    }
    for (const h of document.querySelectorAll('#list h4[data-s], #list h5[data-k]')) {
      const k = h.dataset.s || h.dataset.k;
      const f = folded(k);
      h.querySelector('.tw').textContent = f ? '▸' : '▾';
      h.setAttribute('aria-expanded', String(!f));
      if (h.dataset.k) h.classList.toggle('folded', folded(h.dataset.k.split('/')[0]));
    }
  }
  function select(id, center) {
    // 영역 개요에서 표를 고르면(목록 · 검색 · 주소) 영역 배치로 바꿔 그 표로 간다
    if (id && center && st.overview && areaMode()) { st.overview = false; syncTools(); layout().then(() => select(id, center)); return; }
    st.sel = id;
    paint();
    detail(id);
    if (id && center) centerOn(id);
  }

  // 근거: 기능 ID · 결정 ID 를 누르면 오른쪽 패널에 그 문서 (색인 assets/ids.json 을 docs build 가 모델의 refs 로 넣는다)
  const REFS = M.refs || {};
  const ID_RE = /(?<![\w-])([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\d+)(?![\w-])/g;
  const idLinks = (text) => esc(text).replace(ID_RE, (x) => (REFS[x] ? `<a class="idref" data-ref="${x}">${x}</a>` : x));
  const ref = $('#ref');
  function openRef(label, hrefs) {
    $('#rtitle').textContent = label;
    const rl = $('#rlist');
    rl.innerHTML = hrefs.length > 1 ? `<span>여러 문서에 있음:</span>${hrefs.map((h, i) => `<button data-i="${i}" class="${i ? '' : 'on'}">${esc(h.split('#')[0].replace(/\/index\.html$/, '').replace(/^.*?([^/]+\/[^/]+|[^/]+)$/, '$1'))}</button>`).join('')}` : '';
    const show = (h) => { $('#rframe').src = h; $('#ropen').href = h; };
    for (const b of rl.querySelectorAll('button')) b.addEventListener('click', () => { for (const x of rl.querySelectorAll('button')) x.classList.toggle('on', x === b); show(hrefs[+b.dataset.i]); });
    show(hrefs[0]);
    ref.hidden = false;
  }
  function closeRef() { ref.hidden = true; $('#rframe').src = 'about:blank'; }
  $('#rclose').addEventListener('click', closeRef);
  ref.addEventListener('pointerdown', (e) => e.stopPropagation());
  ref.addEventListener('wheel', (e) => e.stopPropagation());

  function detail(id) {
    const drawer = $('#detail');
    const d = $('#dbody');
    drawer.classList.toggle('open', !!id);
    drawer.setAttribute('aria-hidden', String(!id));
    if (!id) return;
    const t = byId.get(id);
    const kb = (c) => [['pk', c.pk], ['fk', c.fk], ['uk', c.uk]].filter((x) => x[1]).map(([k]) => `<i class="k ${k}">${k.toUpperCase()}</i>`).join(' ');
    const out = rels.filter((r) => r.to === id);
    const inc = rels.filter((r) => r.from === id);
    const lout = lrels.filter((r) => r.to === id);
    const linc = lrels.filter((r) => r.from === id);
    const link = (tid, txt) => `<a data-go="${esc(tid)}">${esc(txt)}</a>`;
    const fn = (f) => (REFS[f] ? `<a class="fn idref" data-ref="${esc(f)}" title="근거 문서 열기">${esc(f)}</a>` : `<span class="fn" title="색인에 없는 ID">${esc(f)}</span>`);
    d.innerHTML = `
      <h3 style="color:${color(t.schema)}">${esc(t.logical || t.name)} <small>${esc(t.id)}</small></h3>
      <div class="sub">${idLinks(t.desc || '')}${t.src ? ` <a class="src idref" data-src="${esc(t.src)}" title="정의서(md) 보기">정의서</a>` : ''}</div>
      <div>${t.fns.map(fn).join('') || `<span class="sub">${t.noFns ? '기능: 없음' : '기능 ID 없음'}</span>`}</div>
      ${(t.areas || []).length || t.code || HUB.has(id) ? `<div class="sub">${(t.areas || []).length ? `영역: ${t.areas.map(esc).join(' · ')}` : ''}${t.code ? `${(t.areas || []).length ? ' · ' : ''}분류: 코드` : ''}${HUB.has(id) ? `${(t.areas || []).length || t.code ? ' · ' : ''}선 숨김 대상` : ''}</div>` : ''}
      ${t.partition || t.retention ? `<div class="sub">${t.partition ? `파티션: ${esc(t.partition)}` : ''}${t.partition && t.retention ? ' · ' : ''}${t.retention ? `보존: ${esc(t.retention)}` : ''}</div>` : ''}
      <h5>컬럼 ${t.columns.length}</h5>
      <table><tr><th>키</th><th>논리명 · 물리명</th><th>타입</th><th>널</th><th>설명</th></tr>
      ${t.columns.map((c) => `<tr><td>${kb(c)}</td><td>${esc(c.logical || '')}<br><span class="c">${esc(c.name)}</span></td><td class="c">${esc(c.type)}</td><td>${c.nullable ? 'Y' : ''}</td><td>${idLinks(c.desc)}${c.ref ? `<br><span class="rel">${c.lref ? '⇢ 논리 ' : '→ '}${link(c.ref.split('.').slice(0, 2).join('.'), c.ref)}</span>` : ''}</td></tr>`).join('')}
      </table>
      <h5>참조함 (이 테이블 → 부모) ${out.length}</h5>
      <div class="rel">${out.map((r) => `${esc(r.toCol)} → ${link(r.from, `${r.from}.${r.fromCol}`)}`).join('<br>') || '<span class="sub">없음</span>'}</div>
      <h5>참조받음 (자식 → 이 테이블) ${inc.length}</h5>
      <div class="rel">${inc.map((r) => `${link(r.to, `${r.to}.${r.toCol}`)}`).join('<br>') || '<span class="sub">없음</span>'}</div>
      ${lout.length || linc.length ? `<h5>논리 참조 (DB 외래키 없음) ${lout.length} · 받음 ${linc.length}</h5>
      <div class="rel">${[...lout.map((r) => `${esc(r.toCol)} ⇢ ${link(r.from, `${r.from}${r.fromCol ? `.${r.fromCol}` : ''}`)}`), ...linc.map((r) => `${link(r.to, `${r.to}.${r.toCol}`)} ⇢ 이 테이블`)].join('<br>')}</div>` : ''}`;
    for (const a of d.querySelectorAll('[data-go]')) a.addEventListener('click', () => select(a.dataset.go, true));
    for (const a of d.querySelectorAll('[data-ref]')) a.addEventListener('click', () => openRef(a.dataset.ref, REFS[a.dataset.ref]));
    for (const a of d.querySelectorAll('[data-src]')) a.addEventListener('click', () => openRef(`${t.id} 정의서`, [a.dataset.src]));
  }

  // 머리 · 목록 · 버튼
  $('#dclose').addEventListener('click', () => select(null));
  $('#detail').addEventListener('pointerdown', (e) => e.stopPropagation()); // 드로어 안 클릭이 캔버스 클릭(선택 해제)으로 번지지 않게
  const mid = () => { const b = stage.getBoundingClientRect(); return [b.width / 2, b.height / 2]; };
  $('#title').textContent = M.title;
  document.title = M.title;
  const back = document.body.dataset.back;
  if (back) $('#back').href = back;
  // 테마: 문서 사이트와 같은 값을 쓴다 (기본 라이트, 바꾼 값만 기억)
  $('#theme').addEventListener('click', () => {
    const v = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = v;
    try { localStorage.setItem('aikit-docs-theme', v); } catch (e) { /* 기억 못 해도 바뀐다 */ }
    layout();
  });
  // 스키마 고르기: 드롭다운 체크 목록(스키마가 많아도 상단 바가 넘치지 않게)
  const sBtn = $('#schemaBtn');
  const sMenu = $('#schemaMenu');
  const sList = $('#schemaList');
  const sCount = () => { $('#schemaCount').textContent = `${M.schemas.length - st.hidden.size}/${M.schemas.length}`; };
  for (const s of M.schemas) {
    const lb = document.createElement('label');
    lb.dataset.s = s;
    lb.innerHTML = `<input type="checkbox" checked><i style="background:${color(s)}"></i>${esc(s)}<span class="n">${M.tables.filter((t) => t.schema === s).length}</span>`;
    sList.append(lb);
  }
  let relayoutT = null;
  const applySchemas = () => {
    sCount();
    aCount();
    // 목록: 숨긴 스키마 · 고르지 않은 영역의 표는 뺀다
    for (const h of document.querySelectorAll('#list h4[data-s]')) h.style.display = st.hidden.has(h.dataset.s) ? 'none' : '';
    for (const h of document.querySelectorAll('#list h5[data-k]')) { const [s, a] = h.dataset.k.split(/\/(.*)/s); h.style.display = st.hidden.has(s) || (areaOn() && !st.areas.has(a)) ? 'none' : ''; }
    for (const a of document.querySelectorAll('#list a')) a.style.display = visible(byId.get(a.dataset.id)) ? '' : 'none';
    if (st.sel && !visible(byId.get(st.sel))) select(null);
    clearTimeout(relayoutT);
    relayoutT = setTimeout(async () => { await layout(); fit(true); }, 250); // 여러 개를 연달아 바꿔도 한 번만 다시 배치
  };
  sList.addEventListener('change', (e) => {
    const s = e.target.closest('label').dataset.s;
    if (e.target.checked) st.hidden.delete(s); else st.hidden.add(s);
    if (st.hidden.size === M.schemas.length) { st.hidden.delete(s); e.target.checked = true; } // 하나는 남긴다
    applySchemas();
  });
  for (const b of sMenu.querySelectorAll('[data-all]')) b.addEventListener('click', () => {
    const on = b.dataset.all === '1';
    const vis = [...sList.querySelectorAll('label')].filter((l) => l.style.display !== 'none');
    for (const l of vis) { if (on) st.hidden.delete(l.dataset.s); else st.hidden.add(l.dataset.s); }
    if (st.hidden.size === M.schemas.length) st.hidden.delete(M.schemas[0]);
    for (const l of sList.querySelectorAll('label')) l.querySelector('input').checked = !st.hidden.has(l.dataset.s);
    applySchemas();
  });
  $('#schemaQ').addEventListener('input', (e) => { const q = e.target.value.trim().toLowerCase(); for (const l of sList.querySelectorAll('label')) l.style.display = !q || l.dataset.s.toLowerCase().includes(q) ? '' : 'none'; });
  sBtn.addEventListener('click', (e) => { e.stopPropagation(); sMenu.hidden = !sMenu.hidden; sBtn.setAttribute('aria-expanded', String(!sMenu.hidden)); if (!sMenu.hidden) $('#schemaQ').focus(); });
  sMenu.addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', () => { sMenu.hidden = true; sBtn.setAttribute('aria-expanded', 'false'); });
  sCount();
  // 영역 고르기: 정의서에 「영역: …」 이 있을 때만 보인다. 모두 고르면 거르지 않는다
  const aWrap = $('#areaWrap');
  const aMenu = $('#areaMenu');
  const aList = $('#areaList');
  const aCount = () => { if (AREAS.length) $('#areaCount').textContent = `${st.areas.size}/${AREAS.length}`; };
  if (AREAS.length && aWrap) {
    aWrap.hidden = false;
    for (const a of AREAS) {
      const lb = document.createElement('label');
      lb.dataset.a = a;
      lb.innerHTML = `<input type="checkbox" checked>${esc(a)}<span class="n">${M.tables.filter((t) => areasOf(t).includes(a)).length}</span>`;
      aList.append(lb);
    }
    aList.addEventListener('change', (e) => {
      const a = e.target.closest('label').dataset.a;
      if (e.target.checked) st.areas.add(a); else st.areas.delete(a);
      if (!st.areas.size) { st.areas.add(a); e.target.checked = true; } // 하나는 남긴다
      applySchemas();
    });
    for (const b of aMenu.querySelectorAll('[data-aall]')) b.addEventListener('click', () => {
      st.areas = b.dataset.aall === '1' ? new Set(AREAS) : new Set([AREAS[0]]);
      for (const l of aList.querySelectorAll('label')) l.querySelector('input').checked = st.areas.has(l.dataset.a);
      applySchemas();
    });
    $('#areaBtn').addEventListener('click', (e) => { e.stopPropagation(); aMenu.hidden = !aMenu.hidden; $('#areaBtn').setAttribute('aria-expanded', String(!aMenu.hidden)); });
    aMenu.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('click', () => { aMenu.hidden = true; $('#areaBtn').setAttribute('aria-expanded', 'false'); });
    aCount();
  }
  // 참조 많은 표 선 숨기기 (기본 꺼짐, 바꾼 값은 브라우저에 기억)
  const hubBox = $('#hubs');
  if (hubBox) {
    hubBox.checked = st.hideHub;
    hubBox.closest('label').title = `들어오는 관계가 ${CONV.hubMin || 10}개 이상인 표 · 코드 표(분류: 코드) · 「ERD: 선 숨김」 표로 가는 선을 숨기고 그 선 없이 배치한다 (${HUB.size}개 표). 표를 고르면 그 표의 선은 보인다`;
    if (!HUB.size) hubBox.closest('label').hidden = true;
    hubBox.addEventListener('change', async () => {
      st.hideHub = hubBox.checked;
      try { localStorage.setItem('erd.hub', st.hideHub ? 'on' : 'off'); } catch (e) { /* 기억 못 해도 바뀐다 */ }
      await layout(); fit(true);
    });
  }
  const list = $('#list');
  // 스키마 접기: 제목 줄을 누르면 접고 편다. 상태는 브라우저에 기억(ERD 마다 따로, 실패해도 동작) · ⌖ 는 캔버스를 그 스키마에 맞춘다
  const foldKey = `erd.fold:${M.title || ''}`;
  st.fold = (() => { try { return new Set(JSON.parse(localStorage.getItem(foldKey) || '[]')); } catch (e) { return new Set(); } })();
  const saveFold = () => { try { localStorage.setItem(foldKey, JSON.stringify([...st.fold])); } catch (e) { /* 기억 못 해도 접힌다 */ } };
  // 영역이 있으면 목록은 스키마 → 영역 → 표 (여러 영역에 든 표는 첫 영역 아래, t.listArea)
  const areaKeys = () => M.schemas.flatMap((s) => AREAS.filter((a) => M.tables.some((t) => t.schema === s && t.listArea === a)).map((a) => `${s}/${a}`));
  st.fold = new Set([...st.fold].filter((k) => M.schemas.includes(k) || areaKeys().includes(k)));
  for (const b of list.querySelectorAll('[data-fold]')) b.addEventListener('click', () => { st.fold = b.dataset.fold === '1' ? new Set([...M.schemas, ...areaKeys()]) : new Set(); saveFold(); paint(); });
  for (const s of M.schemas) {
    const h = document.createElement('h4');
    h.dataset.s = s;
    h.setAttribute('role', 'button');
    h.tabIndex = 0;
    h.title = '누르면 표 목록을 접고 편다';
    h.innerHTML = `<b class="tw">▾</b><i style="background:${color(s)}"></i>${esc(s)} <span class="sub">${M.tables.filter((t) => t.schema === s).length}</span><button class="go" title="이 스키마로 이동 (스키마 묶기를 켜고 그 상자에 맞춘다)" aria-label="${esc(s)} 스키마로 이동">⌖</button>`;
    const toggle = () => { if (st.fold.has(s)) st.fold.delete(s); else st.fold.add(s); saveFold(); paint(); };
    h.addEventListener('click', (e) => { if (e.target.closest('.go')) return; toggle(); });
    h.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    // 관계 중심 배치에서는 한 스키마의 표가 전체에 흩어진다: 스키마 묶기를 켜고 그 상자에 맞춘다
    h.querySelector('.go').addEventListener('click', async () => {
      if (st.hidden.has(s)) return;
      if (st.arrange === 'rel' || st.overview) { if (st.arrange === 'rel') st.arrange = 'schema'; st.overview = false; syncTools(); await layout(); }
      fitTables(M.tables.filter((t) => t.schema === s && visible(t)).map((t) => t.id));
    });
    list.append(h);
    const anchor = (t) => {
      const a = document.createElement('a');
      a.href = `#${t.id}`; a.dataset.id = t.id; a.dataset.l = t.logical || ''; a.dataset.p = t.name; a.title = t.desc;
      if (AREAS.length) a.classList.add('in-area');
      a.addEventListener('click', (e) => { e.preventDefault(); if (!visible(t)) return; select(t.id, true); history.replaceState(null, '', `#${t.id}`); });
      list.append(a);
    };
    if (!AREAS.length) { for (const t of M.tables.filter((x) => x.schema === s)) anchor(t); continue; }
    for (const ar of AREAS) {
      const ts = M.tables.filter((x) => x.schema === s && x.listArea === ar);
      if (!ts.length) continue;
      const k = `${s}/${ar}`;
      const h5 = document.createElement('h5');
      h5.dataset.k = k;
      h5.setAttribute('role', 'button');
      h5.tabIndex = 0;
      h5.innerHTML = `<b class="tw">▾</b>${esc(areaName(ar))} <span class="sub">${ts.length}</span><button class="go" title="이 영역으로 이동 (영역 배치로 바꾸고 그 덩어리에 맞춘다)" aria-label="${esc(areaName(ar))} 영역으로 이동">⌖</button>`;
      const tog = () => { if (st.fold.has(k)) st.fold.delete(k); else st.fold.add(k); saveFold(); paint(); };
      h5.addEventListener('click', (e) => { if (e.target.closest('.go')) { goArea(k); return; } tog(); });
      h5.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tog(); } });
      list.append(h5);
      for (const t of ts) anchor(t);
    }
  }
  const listLabels = () => { for (const a of list.querySelectorAll('a')) { const [x, y] = label(a.dataset.l, a.dataset.p); a.innerHTML = `${esc(x)}${y ? ` <span class="sub">${esc(y)}</span>` : ''}`; } };
  listLabels();
  for (const b of document.querySelectorAll('#names button')) {
    b.classList.toggle('on', b.dataset.n === st.names);
    b.addEventListener('click', async () => {
      st.names = b.dataset.n;
      try { localStorage.setItem('erd.names', st.names); } catch (e) { /* 저장 못 해도 보기는 바뀐다 */ }
      for (const x of document.querySelectorAll('#names button')) x.classList.toggle('on', x === b);
      listLabels();
      await layout(); paint();
    });
  }
  $('#q').addEventListener('input', (e) => { st.q = e.target.value.trim(); paint(); });
  $('#q').addEventListener('keydown', (e) => { if (e.key === 'Enter') { const m = matches(); if (m && m.size) select([...m][0], true); } if (e.key === 'Escape') { e.target.value = ''; st.q = ''; paint(); e.target.blur(); } });
  for (const b of document.querySelectorAll('#levels button')) {
    b.classList.toggle('on', b.dataset.v === st.mode);
    b.addEventListener('click', async () => {
      st.mode = b.dataset.v;
      for (const x of document.querySelectorAll('#levels button')) x.classList.toggle('on', x === b);
      if (st.overview && areaMode()) { st.overview = false; syncTools(); await layout(); await fit(true); }
      const m = mid();
      if (st.mode === 'auto') { const want = levelFor(st.k); if (want !== st.level) await switchLevel(want, ...m); else applyView(); }
      else await switchLevel(st.mode, ...m);
    });
  }
  // 배치: 영역(덩어리 바둑판) · 스키마(상자) · 관계(묶음 없음). 영역 꼬리표가 있으면 영역 배치 + 영역 개요로 연다
  async function goArea(key) {
    const ids = M.tables.filter((t) => visible(t) && chunkOf(t) === key).map((t) => t.id);
    if (!ids.length) return;
    st.arrange = 'area'; st.overview = false; syncTools();
    await layout(); await fitTables(ids, key);
  }
  function syncTools() {
    for (const b of document.querySelectorAll('#arrange button')) b.classList.toggle('on', b.dataset.a === st.arrange);
    const ov = $('#overview');
    if (ov) { ov.classList.toggle('on', st.overview && areaMode()); ov.setAttribute('aria-pressed', String(st.overview && areaMode())); }
    const xw = $('#xareaWrap');
    if (xw) xw.hidden = !areaMode();
    const lg = $('#lgLegend');
    if (lg) lg.hidden = !st.lrefs;
  }
  if (AREAS.length) { st.arrange = 'area'; st.overview = true; } else { for (const x of document.querySelectorAll('#arrange [data-a="area"], #overview')) x.hidden = true; }
  for (const b of document.querySelectorAll('#arrange button')) b.addEventListener('click', async () => {
    if (b.dataset.a === st.arrange && !st.overview) return;
    st.arrange = b.dataset.a; st.overview = false; syncTools();
    await layout(); fit(true); // 고른 배치를 그대로 보인다 (맞춤 · 0 키는 영역 개요로 갈 수 있다)
  });
  if ($('#overview')) $('#overview').addEventListener('click', async () => { st.arrange = 'area'; st.overview = !st.overview; syncTools(); await layout(); fit(true); });
  if ($('#xarea')) $('#xarea').addEventListener('change', (e) => { st.xarea = e.target.checked; layout(); });
  const lrBox = $('#lrefs');
  if (lrBox) {
    lrBox.closest('label').hidden = !lrels.length;
    lrBox.closest('label').title = `논리 참조(참조 칸 「논리: …」, DB 외래키 없음) ${lrels.length}개를 점선으로 그린다. 영역 배치에서 덩어리 사이는 덩어리 → 덩어리 요약선 하나에 개수`;
    lrBox.addEventListener('change', (e) => { st.lrefs = e.target.checked; syncTools(); layout(); });
  }
  syncTools();
  $('#fit').addEventListener('click', () => fit());
  $('#zin').addEventListener('click', () => zoomAt(1.2, ...mid()));
  $('#zout').addEventListener('click', () => zoomAt(1 / 1.2, ...mid()));
  $('#full').addEventListener('click', () => (document.fullscreenElement ? document.exitFullscreen() : stage.requestFullscreen()));
  document.addEventListener('fullscreenchange', () => setTimeout(fit, 50));
  // Export: SQL(PostgreSQL DDL) · SVG · 인쇄
  const xbtn = $('#export');
  const xmenu = $('#exportMenu');
  const closeMenu = () => { xmenu.hidden = true; xbtn.setAttribute('aria-expanded', 'false'); };
  xbtn.addEventListener('click', (e) => { e.stopPropagation(); xmenu.hidden = !xmenu.hidden; xbtn.setAttribute('aria-expanded', String(!xmenu.hidden)); });
  document.addEventListener('click', closeMenu);
  const save = (name, text, type) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const slug = () => (M.title || 'erd').replace(/[^\w가-힣]+/g, '-').replace(/^-|-$/g, '');
  for (const b of xmenu.querySelectorAll('button')) b.addEventListener('click', () => {
    closeMenu();
    const x = b.dataset.x;
    if (x === 'print') window.print();
    else if (x === 'print-areas') printAreas();
    else if (x === 'svg') save(`${slug()}.svg`, svgText(), 'image/svg+xml');
    else save(`${slug()}${x === 'sql-vis' ? '-visible' : ''}.sql`, ddl(x === 'sql-vis' ? M.schemas.filter((s2) => !st.hidden.has(s2)) : M.schemas), 'application/sql');
  });
  const conv = CONV;
  for (const x of document.querySelectorAll('.dia')) x.textContent = window.ERD_DDL ? ERD_DDL.NAMES[ERD_DDL.dialectOf(conv.dialect)] : 'PostgreSQL';
  const ddl = (schemas) => ERD_DDL.ddl(M, schemas, { dialect: conv.dialect, fkInDb: conv.fkInDb, now: new Date().toLocaleString('sv-SE').slice(0, 16) });
  function svgText() {
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
    for (const a of AREAS) {
      st.areas = new Set([a]);
      if (!M.tables.some(visible)) continue;
      await layout();
      const c = svg.cloneNode(true);
      c.removeAttribute('id');
      c.setAttribute('viewBox', `0 0 ${st.W} ${st.H}`);
      c.querySelector('#vp').removeAttribute('transform');
      for (const n of c.querySelectorAll('[id]')) if (n.id !== 'one' && n.id !== 'many') n.removeAttribute('id');
      pages.push(`<section class="pg"><h2>${a === NOAREA ? '영역 꼬리표 없는 테이블' : `${esc(a)} 영역`} <small>${esc(M.title || '')} · 테이블 ${M.tables.filter(visible).length}</small></h2>${new XMLSerializer().serializeToString(c)}</section>`);
    }
    st.areas = keep.areas; st.arrange = keep.arrange; st.overview = keep.overview;
    await layout();
    Object.assign(st, { x: keep.x, y: keep.y, k: keep.k }); applyView();
    let box = $('#pages');
    if (!box) { box = document.createElement('div'); box.id = 'pages'; document.body.append(box); }
    box.innerHTML = pages.join('');
    document.body.classList.add('pages');
    const done = () => { document.body.classList.remove('pages'); box.innerHTML = ''; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
  }
  let saved = null;
  window.addEventListener('beforeprint', () => { saved = { x: st.x, y: st.y, k: st.k }; svg.setAttribute('viewBox', `0 0 ${st.W} ${st.H}`); vp.setAttribute('transform', ''); });
  window.addEventListener('afterprint', () => { svg.removeAttribute('viewBox'); Object.assign(st, saved); applyView(); });
  window.addEventListener('resize', () => fitK());
  document.addEventListener('keydown', (e) => {
    if (e.target.matches && e.target.matches('input')) return;
    if (e.key === '/') { e.preventDefault(); $('#q').focus(); }
    else if (e.key === '0') fit();
    else if (e.key === '+' || e.key === '=') zoomAt(1.2, ...mid());
    else if (e.key === '-') zoomAt(1 / 1.2, ...mid());
    else if (e.key === 'f' || e.key === 'F') $('#full').click();
    else if (e.key === 'Escape') { if (!ref.hidden) closeRef(); else select(null); }
  });

  if (typeof ELK === 'undefined') { $('#msg').textContent = '배치 엔진(assets/erd/elk.bundled.js)을 불러오지 못했습니다. aikit docs build 로 다시 만든다'; return; }
  const fromHash = () => { let h = ''; try { h = decodeURIComponent(location.hash.slice(1)); } catch (e) { /* 잘못된 주소 */ } if (byId.has(h) && h !== st.sel) select(h, true); };
  window.addEventListener('hashchange', fromHash);
  layout().then(fit).then(fromHash);
})();
