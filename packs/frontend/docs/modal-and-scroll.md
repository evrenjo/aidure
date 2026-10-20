# 모달·드로어와 스크롤

## 배경 스크롤 잠금은 레이아웃이 정한다

| 레이아웃 | 모달이 열렸을 때 |
|---|---|
| **내부 스크롤 컨테이너** (`#app-scroll` 같은 `h-screen overflow-y-auto` 요소가 페이지를 스크롤) | 잠글 것이 없다. 모달이 `body` 로 포털되면 오버레이가 컨테이너 **바깥**이라 휠 이벤트가 올라가는 경로에 스크롤 요소가 없다. 스크롤바도 그대로 남아 폭 보정이 필요 없다 |
| 창(html) 스크롤 | `html { overflow: hidden }` 잠금 + 스크롤바 폭 보정 + 고정 헤더 보정이 필요하다. 보정이 여러 겹이라 스크롤바가 사라지는 부작용이 남는다 |

내부 컨테이너 방식을 권한다 — 잠금 코드가 통째로 사라진다. 대신 아래 제약이 생긴다.

### 내부 컨테이너면 `window.scrollTo` / `window.scrollY` 를 쓰지 않는다

창이 스크롤하지 않으므로 `window.scrollTo` 는 **조용히 아무 일도 하지 않고** `window.scrollY` 는 **항상 0** 이다.
오류가 없어 "스크롤이 안 움직인다" 로만 드러난다. 컨테이너 기준 유틸을 둔다.

| 쓰지 않는다 | 대신 |
|---|---|
| `window.scrollTo({ top })` | `scrollPageTo(top)` |
| `el.getBoundingClientRect().top + window.scrollY` | `scrollTopOf(el)` |
| `window.addEventListener('scroll', fn)` | `onPageScroll(fn)` (해제 함수 반환) |

`scrollIntoView` 는 가장 가까운 스크롤 조상을 스크롤하므로 그대로 써도 된다.
인쇄 시 컨테이너가 보이는 영역만 찍히지 않게 `@media print` 에서 `height: auto; overflow: visible` 로 되돌린다.

## 긴 본문은 모달 안에서 스크롤

- **둥근 카드 자체를 스크롤시키지 않는다** — 막대가 둥근 모서리를 지나 오버레이 위로 삐져나온다. 카드는 `overflow: hidden` 세로 flex, 스크롤은 안쪽 한 겹이 맡는다.
- 스크롤 영역은 세 갈래를 같은 자리·같은 막대 폭으로 맞춘다: header/footer 슬롯의 본문 · 자동 래퍼(평범형) · 화면이 직접 잡는 스크롤 패널(공용 클래스를 붙인다).
- **스크롤이 없을 때 막대 자리를 잡지 않는다** — `scrollbar-gutter: stable` 은 스크롤 없는 다이얼로그에 빈 띠를 만든다. 우측 여백을 margin + padding 으로 나눠 막대가 내용과 테두리 가운데 오게 한다.
- 바꿀 때는 브라우저에서 `offsetWidth - clientWidth`(막대 폭)와 카드 끝 대비 입력칸·버튼 여백을 잰다. 눈으로는 몇 px 단차를 놓친다.

## 표·목록이 들어가는 다이얼로그는 제목을 header 슬롯에

children 만 넘기면 카드가 통째로 스크롤해 **제목이 밀려 사라진다.** header 슬롯에 두면 제목이 고정되고 본문만 스크롤한다.

```tsx
// React 예시 — 공용 다이얼로그의 header 슬롯
<Dialog
    isOpen={open}
    width={900}
    header={<><h5>Changes applied</h5><p className="text-sm">{n} row(s) changed</p></>}
    onClose={close}
    onRequestClose={close}
>
    <DataTable hidePagination columns={cols} data={rows} loading={loading} />
</Dialog>
```

판정 기준은 "본문이 뷰포트를 넘길 수 있는가". 확인 문구 몇 줄짜리는 children 로 충분하다.
