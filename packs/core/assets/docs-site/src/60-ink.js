/* 펜 필기: 머리 줄 펜 단추로 켜고 끈다 (쪽을 옮겨도 켜진 채). 펜 · 형광펜 · 지우개(획 지우기, 범위 원), 도구마다 색 5 · 크기 4단계,
   자(곧은 선), 되돌리기, 모두 지우기, PNG 받기. 선은 perfect-freehand 로 필압 · 속도에 따라 굵기가 바뀌는 채운 모양으로 그린다
   (펜이 아니면 속도로 필압을 흉내 낸다). 획은 본문(article) 기준 좌표로 이 기기에 쪽마다 저장하고(localStorage), SVG 층이라 인쇄에도 나온다.
   입력: 펜(Apple Pencil · S Pen)이 한 번이라도 닿았으면 펜 = 필기, 손가락 = 브라우저 스크롤 (확대는 막는다).
   펜이 없으면 한 손가락 = 필기, 두 손가락 = 화면 이동. 마우스 = 필기, 휠 = 그 자리 스크롤 */
(function () {
  "use strict";
  var DS = window.DS, html = DS.html, H = DS.hooks;
  var NS = "http://www.w3.org/2000/svg", root = document.documentElement;
  var PREF = "aidure-docs-ink-prefs";
  var TOOLS = {
    pen: { colors: ["var(--fg)", "#cf222e", "#0969da", "#1a7f37", "#bf5af2"], sizes: [2, 3.2, 5, 8] },
    hl: { colors: ["#ffd60a", "#7ee08a", "#7cc4ff", "#ff9ec7", "#ffb35c"], sizes: [10, 16, 22, 30] },
    er: { sizes: [6, 12, 22, 36] }
  };
  var ICO = {
    pen: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>',
    hl: '<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>',
    er: '<path d="M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.828 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21"/><path d="m5.082 11.09 8.828 8.828"/>',
    ruler: '<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/>',
    clear: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    png: '<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',
    close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'
  };
  var r1 = function (v) { return Math.round(v * 10) / 10; };

  /* 획 { t: pen|hl, c: 색, s: 크기, w: 그릴 때 본문 폭, p: [x, y, 필압, …], q: 펜 필압인가 }. 옛 획(d: [x, y, …])은 필압 0.5 로 읽는다 */
  function points(s) {
    if (s.p) { var o = []; for (var i = 0; i < s.p.length; i += 3) o.push([s.p[i], s.p[i + 1], s.p[i + 2]]); return o; }
    var d = s.d || [], out = [];
    for (var j = 0; j < d.length; j += 2) out.push([d[j], d[j + 1], 0.5]);
    return out;
  }
  function outline(s, done) {
    var pts = points(s), hl = s.t === "hl";
    return window.PerfectFreehand.getStroke(pts, {
      size: s.s, thinning: hl ? 0 : 0.55, smoothing: 0.5, streamline: s.r ? 0 : 0.45, simulatePressure: !s.q && !hl, last: done !== false,
      start: { cap: true, taper: 0 }, end: { cap: true, taper: 0 }
    });
  }
  /* 테두리 점 → SVG 경로 (중간점 2차 곡선) */
  function pathOf(o) {
    if (!o.length) return "";
    if (o.length < 3) return "M" + r1(o[0][0]) + " " + r1(o[0][1]) + "Z";
    var d = "M" + r1(o[0][0]) + " " + r1(o[0][1]) + " Q";
    for (var i = 0; i < o.length; i++) { var a = o[i], b = o[(i + 1) % o.length]; d += r1(a[0]) + " " + r1(a[1]) + " " + r1((a[0] + b[0]) / 2) + " " + r1((a[1] + b[1]) / 2) + " "; }
    return d + "Z";
  }

  DS.Ink = function Ink(props) {
    /* props: on, setOn, el(본문 article), page(쪽 경로: 저장 키) */
    var pref = H.useMemo(function () { return DS.load(PREF, {}) || {}; }, []);
    var ts = H.useState(TOOLS[pref.tool] ? pref.tool : "pen"), tool = ts[0], setTool = ts[1];
    var cs = H.useState(pref.color || {}), color = cs[0], setColor = cs[1];
    var ss = H.useState(pref.size || {}), size = ss[0], setSize = ss[1];
    var rs = H.useState(!!pref.ruler), ruler = rs[0], setRuler = rs[1];
    var ver = H.useState(0), bump = function () { ver[1](function (n) { return n + 1; }); };
    var layer = H.useRef(null), ring = H.useRef(null);
    var S = H.useRef({ strokes: [], hist: [], key: "" }).current;   /* 그리는 중 상태는 다시 그리지 않으려 ref 에 */
    S.tool = tool; S.ruler = ruler;
    S.sizeOf = function () { return TOOLS[S.tool].sizes[size[S.tool] == null ? 1 : size[S.tool]]; };
    S.colorOf = function () { return TOOLS[S.tool].colors[color[S.tool] || 0]; };
    var penSeen = H.useRef(!!pref.pen);
    function savePref(extra) { DS.keep(PREF, Object.assign({ tool: tool, color: color, size: size, ruler: ruler, pen: penSeen.current || undefined }, extra || {})); }

    /* 필기 층: 본문(article) 끝에 SVG 하나 (앱이 그리는 본문과 따로, 쪽을 옮겨도 그대로) */
    H.useLayoutEffect(function () {
      if (!props.el) return;
      var L = document.createElementNS(NS, "svg");
      L.setAttribute("class", "ink-layer");
      L.setAttribute("aria-hidden", "true");
      props.el.appendChild(L);
      layer.current = L;
      return function () { L.remove(); layer.current = null; };
    }, [props.el]);
    /* 쪽이 바뀌면 그 쪽 획을 읽는다 (새 본문과 같은 화면에: 앞 쪽 획이 잠깐 보이지 않게) */
    H.useLayoutEffect(function () {
      S.key = "aidure-docs-ink:" + new URL(DS.url(props.page)).pathname;
      var v = DS.load(S.key, []);
      S.strokes = Array.isArray(v) ? v : [];
      S.hist = [];
      S.render();
      bump();
    }, [props.page]);
    H.useLayoutEffect(function () { root.classList.toggle("ink-on", props.on); if (props.on) S.render(); else if (ring.current) ring.current.classList.remove("on"); }, [props.on]);
    H.useLayoutEffect(function () { root.classList.toggle("ink-erase", tool === "er"); }, [tool]);
    H.useEffect(function () { if (penSeen.current) root.classList.add("ink-pen"); }, []);

    var W = function () { return (props.el && props.el.offsetWidth) || 1; };
    function el(s, done) {
      var e = document.createElementNS(NS, "path");
      e.setAttribute("d", pathOf(outline(s, done)));
      if (s.t === "hl") e.setAttribute("class", "hl");
      e.style.fill = s.c;
      var k = W() / (s.w || W());
      if (Math.abs(k - 1) > 0.001) e.setAttribute("transform", "scale(" + k + ")");
      return e;
    }
    S.render = function () {
      var L = layer.current, page = props.el;
      if (!L || !page) return;
      // 높이는 층을 뺀 본문으로 잰다 (층이 들어간 채 재면 긴 쪽에서 짧은 쪽으로 옮겨도 줄지 않고 아래에 빈 공간이 남는다)
      L.style.display = "none";
      var h = Math.max(page.scrollHeight, page.offsetHeight);
      L.style.display = "";
      L.setAttribute("width", W());
      L.setAttribute("height", h);
      while (L.firstChild) L.removeChild(L.firstChild);
      S.strokes.forEach(function (s) { L.appendChild(el(s)); });
      if (S.curEl) L.appendChild(S.curEl);
    };
    S.save = function () { DS.keep(S.key, S.strokes.length ? S.strokes : null); bump(); };
    S.snap = function () { S.hist.push(JSON.stringify(S.strokes)); if (S.hist.length > 50) S.hist.shift(); };
    function undo() { if (!S.hist.length) return; S.strokes = JSON.parse(S.hist.pop()); S.render(); S.save(); }

    /* 본문 크기가 바뀌면(창 · 펼침 · 그림 · 인쇄) 다시 그린다 */
    H.useEffect(function () {
      if (!props.el) return;
      var again = function () { requestAnimationFrame(S.render); };
      var ro = window.ResizeObserver ? new ResizeObserver(again) : null;
      if (ro) ro.observe(props.el); else window.addEventListener("resize", again);
      window.addEventListener("beforeprint", S.render);
      window.addEventListener("afterprint", again);
      return function () { if (ro) ro.disconnect(); else window.removeEventListener("resize", again); window.removeEventListener("beforeprint", S.render); window.removeEventListener("afterprint", again); };
    }, [props.el]);

    /* Esc = 끝내기 · ⌘Z = 되돌리기 (잡기 단계: 다른 스크립트가 막아도 듣는다). 한 번만 걸고 지금 값은 ref 로 */
    var live = H.useRef(props);
    live.current = props;
    H.useEffect(function () {
      function key(e) {
        if (!root.classList.contains("ink-on")) return;
        if (e.key === "Escape" || e.key === "Esc" || e.keyCode === 27) { e.preventDefault(); live.current.setOn(false); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); }
        else if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
      }
      window.addEventListener("keydown", key, true);
      return function () { window.removeEventListener("keydown", key, true); };
    }, []);

    /* 입력 (필기를 켠 동안). 층에 한 번만 건다 */
    H.useEffect(function () {
      var L = layer.current;
      if (!L) return;
      var cur = null, curId = null, curTouch = false, erased = false, erLast = null, penDown = false;
      var fingers = {}, pan = null, vel = [0, 0], lastT = 0, fling = 0, glideAt = [0, 0];
      var on = function () { return root.classList.contains("ink-on"); };
      function markPen() { if (!penSeen.current) { penSeen.current = true; root.classList.add("ink-pen"); var p = DS.load(PREF, {}) || {}; p.pen = true; DS.keep(PREF, p); } }
      /* iPad Safari 는 SVG 의 touch-action 을 다 따르지 않아 막을 터치는 터치 이벤트에서 직접 막는다 */
      function block(e) {
        if (!on()) return;
        var stylus = false;
        for (var i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].touchType === "stylus") { stylus = true; markPen(); }
        if (penSeen.current && !stylus && !penDown) return;
        if (e.cancelable) e.preventDefault();
      }
      var nFingers = function () { return Object.keys(fingers).length; };
      function centroid() { var x = 0, y = 0, n = 0; for (var k in fingers) { x += fingers[k][0]; y += fingers[k][1]; n++; } return [x / n, y / n]; }
      function at(e) { var r = props.el.getBoundingClientRect(); return [r1(e.clientX - r.left), r1(e.clientY - r.top)]; }
      function pressure(e) { return e.pointerType === "pen" && e.pressure > 0 ? Math.round(e.pressure * 100) / 100 : 0.5; }
      function segDist(px, py, ax, ay, bx, by) {
        var dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0;
        return Math.hypot(px - ax - t * dx, py - ay - t * dy);
      }
      function eraseAt(x, y) {
        var r = S.sizeOf(), w = W(), before = S.strokes.length;
        S.strokes = S.strokes.filter(function (s) {
          var k = w / (s.w || w), p = points(s), lim = r + (s.s * k) / 2;
          if (p.length < 2) return !p.length || Math.hypot(x - p[0][0] * k, y - p[0][1] * k) > lim;
          for (var i = 0; i < p.length - 1; i++) if (segDist(x, y, p[i][0] * k, p[i][1] * k, p[i + 1][0] * k, p[i + 1][1] * k) <= lim) return false;
          return true;
        });
        if (S.strokes.length !== before) { if (!erased) { S.hist.push(JSON.stringify(cur)); erased = true; } S.render(); }
      }
      function eraseTo(x, y) {   /* 지우개가 지난 길 전체 (빠르게 움직여도 사이의 획을 놓치지 않는다) */
        if (erLast) { var dx = x - erLast[0], dy = y - erLast[1], n = Math.ceil(Math.hypot(dx, dy) / Math.max(2, S.sizeOf() / 2));
          for (var i = 1; i < n; i++) eraseAt(erLast[0] + dx * i / n, erLast[1] + dy * i / n); }
        eraseAt(x, y); erLast = [x, y];
      }
      function showRing(e) {
        if (S.tool !== "er" || !ring.current) return;
        var d = S.sizeOf() * 2, g = ring.current;
        g.style.width = g.style.height = d + "px";
        g.style.left = e.clientX + "px"; g.style.top = e.clientY + "px";
        g.classList.add("on");
      }
      /* 자: 시작점에서 지금 점까지 곧은 선. 가로 · 세로 · 45° 근처(6° 안)면 그 각으로 붙인다 */
      function straight(p, pr) {
        var x0 = cur.p[0], y0 = cur.p[1], dx = p[0] - x0, dy = p[1] - y0, len = Math.hypot(dx, dy);
        if (len) { var ang = Math.atan2(dy, dx), step = Math.PI / 4, near = Math.round(ang / step) * step;
          if (Math.abs(ang - near) < Math.PI / 30) { dx = len * Math.cos(near); dy = len * Math.sin(near); } }
        return [x0, y0, cur.p[2], r1(x0 + dx), r1(y0 + dy), pr];
      }
      function start(e) {
        try { L.setPointerCapture(e.pointerId); } catch (x) { /* 없음 */ }
        curId = e.pointerId; curTouch = e.pointerType === "touch";
        var p = at(e);
        if (S.tool === "er") { cur = S.strokes.slice(); erased = false; erLast = null; eraseTo(p[0], p[1]); showRing(e); return; }
        cur = { t: S.tool, c: S.colorOf(), s: S.sizeOf(), w: W(), q: e.pointerType === "pen" || undefined, p: [p[0], p[1], pressure(e)] };
        S.curEl = el(cur, false);
        L.appendChild(S.curEl);
      }
      function drop() {   /* 두 번째 손가락: 첫 손가락이 긋던 획 · 지우던 것을 되돌린다 */
        if (!cur) return;
        if (S.tool === "er") { if (erased) { S.strokes = cur; S.hist.pop(); S.render(); } }
        else if (S.curEl) S.curEl.remove();
        cur = null; S.curEl = null; curId = null; erased = false;
      }
      /* 스크롤은 손가락 · 펜 · 마우스가 있는 자리의 요소로: 필기 층 아래에서 위로 올라가며 그 방향으로 더 움직일 수 있는 첫 스크롤 상자, 없으면 창 */
      function under(x, y) {
        var list = document.elementsFromPoint ? document.elementsFromPoint(x, y) : [];
        for (var i = 0; i < list.length; i++) if (list[i] !== L && !L.contains(list[i])) return list[i];
        return null;
      }
      function canScroll(n, ax, d) {
        var o = getComputedStyle(n)[ax === "x" ? "overflowX" : "overflowY"];
        if (!/auto|scroll|overlay/.test(o)) return false;
        if (ax === "x") return d > 0 ? n.scrollLeft + n.clientWidth < n.scrollWidth - 1 : n.scrollLeft > 0;
        return d > 0 ? n.scrollTop + n.clientHeight < n.scrollHeight - 1 : n.scrollTop > 0;
      }
      function scrollAt(x, y, dx, dy) {
        var t = under(x, y);
        [["x", dx], ["y", dy]].forEach(function (a) {
          var ax = a[0], d = a[1];
          if (!d) return;
          for (var n = t; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
            if (canScroll(n, ax, d)) { if (ax === "x") n.scrollLeft += d; else n.scrollTop += d; return; }
          }
          window.scrollBy(ax === "x" ? d : 0, ax === "y" ? d : 0);
        });
      }
      function wheel(e) {
        if (!on() || e.ctrlKey) return;
        var k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1, dx = e.deltaX * k, dy = e.deltaY * k;
        if (e.shiftKey && !dx) { dx = dy; dy = 0; }
        e.preventDefault();
        scrollAt(e.clientX, e.clientY, dx, dy);
      }
      function glide() {
        cancelAnimationFrame(fling);
        var step = function () {
          vel = [vel[0] * 0.92, vel[1] * 0.92];
          if (Math.abs(vel[0]) < 0.02 && Math.abs(vel[1]) < 0.02) return;
          scrollAt(glideAt[0], glideAt[1], -vel[0] * 16, -vel[1] * 16);
          fling = requestAnimationFrame(step);
        };
        fling = requestAnimationFrame(step);
      }
      function down(e) {
        e.preventDefault();
        cancelAnimationFrame(fling);
        if (e.pointerType === "pen") { markPen(); penDown = true; if (!cur) start(e); return; }
        if (e.pointerType === "mouse") { if (e.button === 0 && !cur) start(e); return; }
        if (penSeen.current) return;   /* 손가락 = 브라우저 기본 스크롤 */
        fingers[e.pointerId] = [e.clientX, e.clientY];
        try { L.setPointerCapture(e.pointerId); } catch (x) { /* 없음 */ }
        if (nFingers() >= 2) { if (cur && curTouch) drop(); pan = centroid(); vel = [0, 0]; lastT = e.timeStamp; return; }
        if (!cur) start(e);
      }
      function move(e) {
        if (e.pointerType === "touch" && fingers[e.pointerId]) {
          var o = fingers[e.pointerId], n = Math.min(2, nFingers());
          fingers[e.pointerId] = [e.clientX, e.clientY];
          if (pan && n >= 2) {
            /* 움직인 손가락 하나의 이동 / 2 = 가운데 점의 이동 (손가락이 닿고 떨어져도 튀지 않는다) */
            var dx = (e.clientX - o[0]) / n, dy = (e.clientY - o[1]) / n, dt = e.timeStamp - lastT;
            pan = centroid();
            if (!dx && !dy) return;
            scrollAt(pan[0], pan[1], -dx, -dy);
            if (dt > 0) { var a = Math.min(1, dt / 50), cap = function (v) { return Math.max(-3, Math.min(3, v)); };
              vel = [vel[0] + (cap(dx * n / Math.max(dt, 8)) - vel[0]) * a, vel[1] + (cap(dy * n / Math.max(dt, 8)) - vel[1]) * a]; lastT = e.timeStamp; }
            return;
          }
        }
        if (e.pointerType !== "touch") showRing(e);
        if (!cur || e.pointerId !== curId) return;
        var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
        if (!evs.length) evs = [e];
        if (S.tool === "er") { evs.forEach(function (ev) { var p = at(ev); eraseTo(p[0], p[1]); }); return; }
        if (S.ruler || e.shiftKey) { var last = evs[evs.length - 1]; cur.p = straight(at(last), pressure(last)); cur.r = 1; }
        else evs.forEach(function (ev) {
          var p = at(ev), d = cur.p, lx = d[d.length - 3], ly = d[d.length - 2];
          if (Math.hypot(p[0] - lx, p[1] - ly) >= 1) d.push(p[0], p[1], pressure(ev));
        });
        if (S.curEl) S.curEl.setAttribute("d", pathOf(outline(cur, false)));
      }
      function end(e) {
        if (e.pointerType === "pen") penDown = false;
        if (e.pointerType === "touch" && fingers[e.pointerId]) {
          delete fingers[e.pointerId];
          if (pan && nFingers() < 2) { glideAt = pan; pan = null; if (e.timeStamp - lastT < 80) glide(); }
        }
        if (!cur || e.pointerId !== curId) return;
        if (S.tool === "er") { if (erased) S.save(); }
        else { S.snap(); if (cur.r) delete cur.r; S.strokes.push(cur); S.curEl = null; S.render(); S.save(); }
        cur = null; S.curEl = null; curId = null; erased = false;
      }
      function leave() { if (ring.current) ring.current.classList.remove("on"); }
      L.addEventListener("touchstart", block, { passive: false });
      L.addEventListener("touchmove", block, { passive: false });
      L.addEventListener("wheel", wheel, { passive: false });
      L.addEventListener("pointerdown", down);
      L.addEventListener("pointermove", move);
      L.addEventListener("pointerup", end);
      L.addEventListener("pointercancel", end);
      L.addEventListener("pointerleave", leave);
      return function () {
        L.removeEventListener("touchstart", block); L.removeEventListener("touchmove", block); L.removeEventListener("wheel", wheel);
        L.removeEventListener("pointerdown", down); L.removeEventListener("pointermove", move); L.removeEventListener("pointerup", end);
        L.removeEventListener("pointercancel", end); L.removeEventListener("pointerleave", leave);
        cancelAnimationFrame(fling);
      };
    }, [props.el]);

    /* PNG: 필기 층만 본문 크기 그대로 (배경 = 지금 테마 색). 큰 쪽은 브라우저 한도 안으로 줄인다 */
    function png() {
      var page = props.el, L = layer.current, w = W(), h = Number(L.getAttribute("height")) || page.offsetHeight, cs = getComputedStyle(document.body);
      var k = Math.min(2, 16384 / w, 16384 / h, Math.sqrt(16e6 / (w * h)));
      var copy = L.cloneNode(true), fg = getComputedStyle(root).getPropertyValue("--fg").trim() || "#1f2328";
      copy.setAttribute("xmlns", NS);
      copy.setAttribute("viewBox", "0 0 " + w + " " + h);
      copy.removeAttribute("class");
      Array.prototype.forEach.call(copy.querySelectorAll("path"), function (n) {
        if (n.style.fill.indexOf("var(") >= 0) n.style.fill = fg;
        if (n.getAttribute("class") === "hl") n.style.opacity = ".5";
      });
      var img = new Image();
      img.onload = function () {
        var c = document.createElement("canvas");
        c.width = Math.round(w * k); c.height = Math.round(h * k);
        var g = c.getContext("2d");
        g.fillStyle = cs.backgroundColor || "#fff"; g.fillRect(0, 0, c.width, c.height);
        g.drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(function (b) {
          if (!b) return;
          var a = document.createElement("a");
          a.href = URL.createObjectURL(b);
          var h1 = page.querySelector("h1");
          a.download = ((h1 && h1.textContent) || document.title).trim().replace(/[\\/:*?"<>|]+/g, " ").slice(0, 80) + " 필기.png";
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
        }, "image/png");
      };
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(copy));
    }

    var t = TOOLS[tool];
    var pick = function (fn) { return function () { fn(); }; };
    H.useEffect(function () { savePref(); }, [tool, color, size, ruler]);
    var bar = html`<div class="ink-bar" role="toolbar" aria-label="펜 필기 도구">
      ${["pen", "hl", "er"].map(function (k) { return html`<button type="button" key=${k} class=${k === tool ? "on" : ""} title=${{ pen: "펜", hl: "형광펜", er: "지우개" }[k]} aria-pressed=${k === tool} onClick=${pick(function () { setTool(k); })}><${DS.Icon} paths=${ICO[k]} /></button>`; })}
      ${t.colors ? html`<span class="ink-sep"></span>${t.colors.map(function (c, i) {
        return html`<button type="button" key=${"c" + i} class=${"ink-c" + (i === (color[tool] || 0) ? " on" : "")} title=${"색 " + (i + 1)} style=${"--c:" + c} onClick=${pick(function () { var n = Object.assign({}, color); n[tool] = i; setColor(n); })}><i></i></button>`;
      })}` : null}
      <span class="ink-sep"></span>
      ${t.sizes.map(function (v, i) {
        var dot = Math.round(4 + i * 3.5);
        return html`<button type="button" key=${"s" + i} class=${"ink-s" + (i === (size[tool] == null ? 1 : size[tool]) ? " on" : "")} title=${"크기 " + (i + 1)} onClick=${pick(function () { var n = Object.assign({}, size); n[tool] = i; setSize(n); })}><i style=${{ width: dot + "px", height: dot + "px" }}></i></button>`;
      })}
      <span class="ink-sep"></span>
      <button type="button" class=${ruler ? "on" : ""} aria-pressed=${ruler} title="자: 곧은 선 (가로 · 세로 · 45° 에 붙음. 마우스는 Shift 를 누른 동안도)" onClick=${pick(function () { setRuler(!ruler); })}><${DS.Icon} paths=${ICO.ruler} /></button>
      <button type="button" title="되돌리기 (⌘Z · Ctrl+Z)" disabled=${!S.hist.length} onClick=${undo}><${DS.Icon} paths=${ICO.undo} /></button>
      <button type="button" title="이 쪽 필기 모두 지우기 (되돌리기로 살린다)" disabled=${!S.strokes.length} onClick=${function () { S.snap(); S.strokes = []; S.render(); S.save(); }}><${DS.Icon} paths=${ICO.clear} /></button>
      <button type="button" title="필기 PNG 받기" disabled=${!S.strokes.length} onClick=${png}><${DS.Icon} paths=${ICO.png} /></button>
      <button type="button" title="필기 끝내기 (Esc)" onClick=${function () { props.setOn(false); }}><${DS.Icon} paths=${ICO.close} /></button>
    </div>`;
    /* 막대 · 지우개 원은 화면에 고정 */
    return html`<div class="ink-eraser" ref=${ring}></div>${bar}`;
  };
})();
