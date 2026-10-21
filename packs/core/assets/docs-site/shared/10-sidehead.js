/* 사이드바 머리 줄 (문서 사이트 · ERD 뷰어 공통 부품): 왼쪽 = 제목(문서는 「홈」 링크, ERD 는 「테이블 n」), 오른쪽 = 모두 접기 ↔ 모두 펴기 토글 하나.
   펼친 묶음이 하나라도 있으면 「모두 접기」, 모두 접혀 있으면 「모두 펴기」 (아이콘 · 툴팁이 다음 동작). 생성기가 site.js · erd.js 앞에 같이 넣는다.
   아이콘: Lucide house · chevrons-down-up · chevrons-up-down (ISC) */
(function () {
  "use strict";
  var h = window.preact.h, html = window.htm.bind(h);
  var svg = function (d) { return html`<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" dangerouslySetInnerHTML=${{ __html: d }}></svg>`; };
  var I = {
    home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    fold: '<path d="m7 20 5-5 5 5"/><path d="m7 4 5 5 5-5"/>',
    unfold: '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>'
  };
  /** props: { label, href?, home?, current?, anyOpen, onToggle(open) } */
  window.SideHead = function SideHead(props) {
    var title = props.href
      ? html`<a class=${"side-head-title" + (props.current ? " on" : "")} href=${props.href} aria-current=${props.current ? "page" : undefined}>${props.home ? svg(I.home) : null}<span>${props.label}</span></a>`
      : html`<span class="side-head-title">${props.label}</span>`;
    var tip = props.anyOpen ? "모두 접기" : "모두 펴기";
    return html`<div class="side-head">${title}<button type="button" class="side-head-btn" title=${tip} aria-label=${tip} onClick=${function () { props.onToggle(!props.anyOpen); }}>${svg(props.anyOpen ? I.fold : I.unfold)}</button></div>`;
  };
})();
