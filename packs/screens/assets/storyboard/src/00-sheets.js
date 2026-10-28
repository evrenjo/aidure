/* 화면설계서 뷰어 (screens 팩): 상단 바(구분 · 장 선택 · 이전/다음 · 발표 · 내부 정보 · 인쇄) + 좌측 썸네일 + 근거 패널.
 * 생성기가 src/*.js 를 이름 순으로 이어 assets/storyboard/storyboard.js 하나로 만든다. 화면은 문서 사이트와 같은 assets/vendor.js (Preact + htm).
 * 각 장: <section class="sheet" id="…" data-group="큰 구분" data-label="장 이름"> (사람이 쓴 HTML 그대로 두고, 뷰어는 그 둘레만 그린다)
 * 키: ←/→ 이전·다음, F5 · F 발표(→ · Space · 클릭 다음, ← 이전, Esc 끝), I 내부 정보, Esc 근거 패널 닫기
 * 내부 정보(기본 보기 · 인쇄에서 숨김): Check Point(h3 + .check) · 근거 줄(.refs) · 마커별 근거 ID(.side ol.desc li 안의 ul) · class="sb-dev" 요소
 * 여기: 장 모으기 · 장 크기(화면 맞춤 · 인쇄 · 한 쪽 넘침) · 마커 호버 · 근거 링크 걸기 · md 보기 */
(function () {
  'use strict';
  const SB = window.SB = window.SB || {};
  const sheets = SB.sheets = Array.from(document.querySelectorAll('section.sheet'));
  if (!sheets.length) return;
  SB.docTitle = document.body.getAttribute('data-doc') || document.title;
  sheets.forEach((s, i) => {
    if (!s.id) s.id = `p${i + 1}`;
    if (!s.dataset.group) s.dataset.group = '기타';
    if (!s.dataset.label) s.dataset.label = s.id;
    // 클래스 없는 Check Point 제목도 바로 뒤 .check 를 보고 내부 정보로 (썸네일 복제 전에)
    s.querySelectorAll('h3').forEach((h) => { const n = h.nextElementSibling; if (n && n.classList.contains('check')) h.classList.add('sb-dev'); });
  });
  SB.groups = [...new Set(sheets.map((s) => s.dataset.group))];
  SB.SHEET_W = 1280;
  SB.THUMB_W = 196;
  SB.devOn = () => document.body.classList.contains('sb-dev-on');
  SB.esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /* 근거 패널이 열린 동안 · 좁은 화면(860px 이하)은 장을 다시 배치하지 않고 원래 배치 그대로 남은 폭에 맞춰 줄인다 (두 손가락으로 확대) */
  SB.fitSheets = (main, panelOn, presenting) => {
    if (presenting || !main) return;
    const on = (panelOn && window.innerWidth > 1000) || window.innerWidth <= 860;
    const cs = getComputedStyle(main);
    const avail = main.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const k = on ? Math.min(1, avail / SB.SHEET_W) : 1;
    sheets.forEach((s) => {
      s.style.width = on ? `${SB.SHEET_W}px` : '';
      s.style.maxWidth = on ? 'none' : '';
      s.style.zoom = on && k < 1 ? String(k) : '';
    });
  };
  /* 발표: 현재 장 하나를 화면 가득(비율 유지) */
  SB.fitPresent = (cur) => {
    const s = sheets[cur];
    sheets.forEach((x) => { x.style.zoom = ''; });
    if (s) s.style.zoom = String(Math.min(window.innerWidth / s.offsetWidth, window.innerHeight / s.offsetHeight));
  };
  /* 인쇄: 한 장 = A4 가로 한 쪽(885px 높이를 0.83 배). 설명이 길어 885px 를 넘는 장은 잘리지 않게 더 줄인다 */
  const PRINT_H = 885, PRINT_ZOOM = 0.83;
  /* 장의 원래 높이(폭 1280px 기준). 화면 축소 · 패널과 상관없이 잰다 */
  function naturalH(s) {
    const keep = { w: s.style.width, mw: s.style.maxWidth, z: s.style.zoom };
    s.style.width = `${SB.SHEET_W}px`; s.style.maxWidth = 'none'; s.style.zoom = '';
    const h = s.offsetHeight;
    s.style.width = keep.w; s.style.maxWidth = keep.mw; s.style.zoom = keep.z;
    return h;
  }
  SB.fitPrint = () => {
    sheets.forEach((s) => {
      s.style.removeProperty('--print-h'); s.style.removeProperty('--print-zoom');
      const h = naturalH(s);
      if (h <= PRINT_H) return;
      s.style.setProperty('--print-h', `${h}px`);
      s.style.setProperty('--print-zoom', String(Math.floor(PRINT_ZOOM * PRINT_H / h * 1000) / 1000));
    });
  };
  /* 넘침 표시: 한 쪽을 넘는 장은 위에 띠 (화면에서만, 인쇄 · 발표에는 안 나온다). 내용을 줄이거나 장을 나누라는 신호.
   * 내부 정보를 켜 두어도 기본 보기(내부 정보 제외 = 기본 인쇄) 높이로 잰다. 돌려주는 값 = 장마다 넘쳤는가 (썸네일 ⚠) */
  SB.OVER_TIP = '기본 보기(내부 정보 제외, 인쇄 기준) 높이로 잼';
  SB.markOver = () => {
    const dev = SB.devOn();
    if (dev) document.body.classList.remove('sb-dev-on');
    const hs = sheets.map(naturalH);
    if (dev) document.body.classList.add('sb-dev-on');
    return sheets.map((s, i) => {
      const h = hs[i], over = h > PRINT_H;
      let badge = s.querySelector(':scope > .sb-over-badge');
      s.classList.toggle('sb-over', over);
      if (!over) { if (badge) badge.remove(); return false; }
      if (!badge) { badge = document.createElement('div'); badge.className = 'sb-over-badge'; badge.title = `${SB.OVER_TIP}. 내부 정보를 켜고 인쇄하면 더 줄어든다`; s.appendChild(badge); }
      badge.textContent = `⚠ 한 쪽 넘침 (${h - PRINT_H}px): 인쇄하면 다른 장의 ${Math.round(PRINT_H / h * 100)}% 크기로 줄어듦. 설명을 줄이거나 장을 나누세요`;
      return true;
    });
  };

  /* 마커 호버(마우스 기기만): Description 줄이나 와이어프레임 마커(.mk)에 올리면 그 줄 · 마커를 강조하고 그 줄의 근거 ID 를 잠깐 보인다 */
  let peek = [];
  SB.clearPeek = () => { peek.forEach((n) => n.classList.remove('sb-peek', 'sb-hl', 'sb-peeking')); peek = []; };
  SB.peekAt = (target) => {
    let li = target.closest && target.closest('.side ol.desc > li');
    const sheet = target.closest && target.closest('.sheet');
    const mk = !li && target.closest && target.closest('.mk');
    if (!sheet || (!li && (!mk || mk.closest('.side')))) return SB.clearPeek();
    const ol = sheet.querySelector('.side ol.desc');
    if (!ol) return SB.clearPeek();
    if (!li) li = ol.children[parseInt(mk.textContent, 10) - 1];
    if (!li) return SB.clearPeek();
    if (peek[0] === li) return;
    SB.clearPeek();
    const no = Array.prototype.indexOf.call(ol.children, li) + 1;
    li.classList.add('sb-peek', 'sb-hl'); peek.push(li);
    sheet.classList.add('sb-peeking'); peek.push(sheet);
    sheet.querySelectorAll('.mk').forEach((m) => { if (!m.closest('.side') && parseInt(m.textContent, 10) === no) { m.classList.add('sb-hl'); peek.push(m); } });
  };

  /* 근거 링크: ids.json(kedovi docs build 의 색인)으로 본문의 ID · 문서 이름을 링크로 바꾼다 (누르면 앱이 오른쪽 패널에 연다).
   * <body data-root="../"> : 문서 사이트 루트까지의 상대 경로 (색인 = <root>assets/ids.json). kedovi docs build 가 채운다
   * <section data-area="폴더"> 또는 <body data-area> : 여러 문서에 같은 번호가 있는 ID(문서마다 매기는 결정 번호)를 고를 기준 폴더
   * 링크하는 것: 색인에 있는 ID · 이 설계서 안 장의 id · 색인의 문서 이름(.md 생략 가능). 색인의 prefixes 머리말인데 정의가 없으면 빨간 물결 */
  const ROOT = SB.ROOT = document.body.getAttribute('data-root');
  const ID_SRC = '[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\\d+';
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function linkify(index) {
    const prefixes = index.prefixes || [];
    /* 문서 이름: 색인 docs 의 파일 이름 중 - 가 든 것(00-overview · 50-screen-policy). .md 를 붙여 써도 된다 */
    const names = Object.keys(index.docs).map((k) => k.split('/').pop().replace(/\.md$/i, ''))
      .filter((n, i, a) => /-/.test(n) && a.indexOf(n) === i).sort((a, b) => b.length - a.length);
    /* 번호로 시작하는 문서 이름은 앞부분만 써도 된다(20-requirements-05 → 20-requirements-05-api.md, 하나로 좁혀질 때) */
    const REF_RE = new RegExp(`(${ID_SRC}|\\d+-[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\\.md)?${names.length ? `|(?:${names.map(reEsc).join('|')})(?:\\.md)?` : ''})(?![\\w*-])`, 'g');
    function resolve(tok, sheet) {
      const s = document.getElementById(tok);
      if (s && s.classList.contains('sheet')) return { inner: tok };
      let list = index.ids[tok];
      if (!list || !list.length) {
        const name = tok.replace(/\.md$/i, ''), hit = [];
        Object.keys(index.docs).forEach((md) => {
          const base = md.split('/').pop().replace(/\.md$/i, '');
          if ((base === name || base.indexOf(`${name}-`) === 0) && hit.indexOf(index.docs[md]) < 0) hit.push(index.docs[md]);
        });
        if (hit.length === 1) return { hrefs: [ROOT + hit[0]] };
        if (prefixes.some((p) => tok.indexOf(`${p}-`) === 0)) return { broken: true };
        return null;
      }
      const area = (sheet && sheet.dataset.area) || document.body.getAttribute('data-area');
      if (list.length > 1 && area) {
        /* 영역 이름이 경로의 폴더나 파일 이름 조각이면(design/ui-ops/ · 30-design-ui-ops.html) 그 문서를 먼저 */
        const ar = new RegExp(`(^|[/-])${reEsc(area)}([/.-]|$)`);
        const pref = list.filter((h) => ar.test(h.split('#')[0]));
        if (pref.length) list = pref.concat(list.filter((h) => pref.indexOf(h) < 0));
      }
      return { hrefs: list.map((h) => ROOT + h) };
    }
    const link = (text, cls, attrs) => { const a = document.createElement(cls === 'sb-broken' ? 'span' : 'a'); a.className = cls; a.textContent = text; Object.assign(a, attrs); return a; };
    sheets.forEach((sheet) => {
      const walker = document.createTreeWalker(sheet, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentNode.closest('a, script, style, .sb-noref') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
      const nodes = [];
      const probe = new RegExp(REF_RE.source);
      while (walker.nextNode()) if (probe.test(walker.currentNode.nodeValue)) nodes.push(walker.currentNode);
      nodes.forEach((n) => {
        const text = n.nodeValue, frag = document.createDocumentFragment();
        let last = 0, m;
        REF_RE.lastIndex = 0;
        while ((m = REF_RE.exec(text))) {
          if (m.index > 0 && /[\w-]/.test(text[m.index - 1])) continue;
          const r = resolve(m[1], sheet);
          if (!r) continue;
          frag.appendChild(document.createTextNode(text.slice(last, m.index)));
          if (r.broken) { frag.appendChild(link(m[1], 'sb-broken', { title: '색인에 정의가 없는 ID' })); last = m.index + m[1].length; REF_RE.lastIndex = last; continue; }
          const a = link(m[1], 'sb-ref', {});
          if (r.inner) { a.href = `#${r.inner}`; a.dataset.inner = r.inner; }
          else { a.href = r.hrefs[0]; a.dataset.hrefs = JSON.stringify(r.hrefs); a.title = '근거 보기 (⌘/Ctrl+클릭: 새 탭)'; }
          frag.appendChild(a);
          last = m.index + m[1].length;
          /* 줄여 쓴 이어지는 번호: 「VS-ADM-04 · 05 · 07」 의 05 · 07 도 VS-ADM-05 · VS-ADM-07 로 잇는다 */
          const pm = /^([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-)(\d+)$/.exec(m[1]);
          const CONT = /^(\s*[·,]\s*)(\d{2,3})(?![\w-])/;
          let cm;
          while (pm && (cm = CONT.exec(text.slice(last))) && cm[2].length === pm[2].length) {
            const full = pm[1] + cm[2], rr = resolve(full, sheet);
            if (!rr || !rr.hrefs) break;
            frag.appendChild(document.createTextNode(cm[1]));
            const a2 = link(cm[2], 'sb-ref', { href: rr.hrefs[0], title: `${full} 보기 (⌘/Ctrl+클릭: 새 탭)` });
            a2.dataset.hrefs = JSON.stringify(rr.hrefs); a2.dataset.label = full;
            frag.appendChild(a2);
            last += cm[0].length;
          }
          REF_RE.lastIndex = last;
        }
        if (!last) return;
        frag.appendChild(document.createTextNode(text.slice(last)));
        n.parentNode.replaceChild(frag, n);
      });
    });
  }
  SB.linkRefs = () => {
    if (ROOT == null || !window.fetch) return;
    fetch(`${ROOT}assets/ids.json`).then((r) => (r.ok ? r.json() : null)).then((index) => { if (index) linkify(index); })
      .catch(() => { /* 색인을 못 읽으면 글자 그대로 둔다 */ });
  };

  /* md 보기: 근거가 .md 원문이면 받아서 문서 모양으로 그린다 (작은 해석기, 표 · 목록 · 인용 · 코드) */
  const escH = SB.esc;
  /* md 안 링크 주소: http(s) 와 이 페이지와 같은 방식(상대 경로)만. javascript: 등은 버린다 */
  function safeUrl(u, base) {
    try { const x = new URL(u.replace(/&amp;/g, '&'), base); return /^https?:$/.test(x.protocol) || x.protocol === location.protocol ? escH(x.href) : null; } catch (e) { return null; }
  }
  SB.slug = (t) => t.trim().toLowerCase().replace(/[^\w가-힣\s-]/g, '').replace(/\s+/g, '-');
  function mdInline(t, base) {
    const codes = [];
    t = t.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
    t = escH(t)
      .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, a, u) => { const h = safeUrl(u, base); return h ? `<img alt="${a}" src="${h}">` : a; })
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, a, u) => { const h = safeUrl(u, base); return h ? `<a href="${h}">${a}</a>` : a; })
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/~~(.+?)~~/g, '<del>$1</del>')
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
    return t.replace(/\u0000(\d+)\u0000/g, (_, k) => `<code>${escH(codes[+k])}</code>`);
  }
  SB.mdRender = function mdRender(src, base) {
    const lines = src.replace(/\r\n?/g, '\n').split('\n'), out = [];
    let i = 0;
    const cells = (l) => l.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim());
    while (i < lines.length) {
      const l = lines[i];
      let m;
      if (/^```/.test(l)) {
        const buf = []; i++;
        while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
        i++; out.push(`<pre><code>${escH(buf.join('\n'))}</code></pre>`); continue;
      }
      if ((m = /^(#{1,6})\s+(.*)$/.exec(l))) {
        const n = m[1].length, txt = m[2].replace(/\s+#+\s*$/, '');
        out.push(`<h${n} id="${SB.slug(txt)}">${mdInline(txt, base)}</h${n}>`); i++; continue;
      }
      if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
      if (/^\|/.test(l) && i + 1 < lines.length && /^\|?\s*:?-{2,}/.test(lines[i + 1])) {
        const head = cells(l); i += 2;
        const rows = [];
        while (i < lines.length && /^\|/.test(lines[i])) rows.push(cells(lines[i++]));
        out.push(`<div class="md-table"><table><thead><tr>${head.map((c) => `<th>${mdInline(c, base)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${mdInline(c, base)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
        continue;
      }
      if (/^>\s?/.test(l)) {
        const q = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ''));
        out.push(`<blockquote>${mdRender(q.join('\n'), base)}</blockquote>`); continue;
      }
      if (/^\s*([-*+]|\d+\.)\s+/.test(l)) {
        const ordered = /^\s*\d+\./.test(l), items = [];
        while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
          let it = lines[i].replace(/^\s*([-*+]|\d+\.)\s+/, '');
          const ind = /^\s*/.exec(lines[i])[0].length;
          const task = /^\[( |x)\]\s+/i.exec(it);
          if (task) it = `<input type="checkbox" disabled${task[1] !== ' ' ? ' checked' : ''}> ${mdInline(it.slice(task[0].length), base)}`;
          else it = mdInline(it, base);
          items.push(`<li style="margin-left:${ind * 8}px">${it}</li>`); i++;
        }
        out.push(`${ordered ? '<ol>' : '<ul>'}${items.join('')}${ordered ? '</ol>' : '</ul>'}`); continue;
      }
      if (!l.trim()) { i++; continue; }
      const para = [];
      while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|\||>|\s*([-*+]|\d+\.)\s)/.test(lines[i])) para.push(lines[i++]);
      out.push(`<p>${mdInline(para.join(' '), base)}</p>`);
    }
    return out.join('\n');
  };
})();
