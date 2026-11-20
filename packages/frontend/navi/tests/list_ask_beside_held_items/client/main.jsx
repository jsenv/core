/*
 * A thread read by range, scrolling the page: 2400 rows of 44px, opened on row
 * 2200, the source answering a page of 100 after 200ms. Every range asked is
 * kept in `window.requests`.
 *
 * `window.jumpTo(row)` scrolls the page so `row` stands at the top of the
 * screen — the way a fling leaves the window standing somewhere, its pages
 * behind.
 */

import { List, resource, whenPageAtRest } from "@jsenv/navi";
import { render } from "preact";

const ROW_COUNT = 2400;
const ROW = 44;
const ROWS = [];
let index = 0;
while (index < ROW_COUNT) {
  ROWS.push({ id: `row_${index}`, label: `row ${index}` });
  index++;
}

window.requests = [];
const ROW_RESOURCE = resource("row", {
  GET_RANGE: async ({ start, limit, around }) => {
    if (around !== undefined) {
      const aroundIndex = Number(String(around).split("_")[1]);
      start = Math.max(0, aroundIndex - Math.floor(limit / 2));
    }
    window.requests.push({ start, end: start + limit - 1 });
    await new Promise((resolve) => setTimeout(resolve, 200));
    return { items: ROWS.slice(start, start + limit), start, count: ROW_COUNT };
  },
});
const itemsAction = ROW_RESOURCE.GET_RANGE.bindParams({ scope: "thread" });
const itemSize = () => ROW;
const renderItem = (row) => (
  <List.Item style={{ height: `${ROW}px`, boxSizing: "border-box" }}>
    {row.label}
  </List.Item>
);

const App = () => (
  <List
    scroller="document"
    border="none"
    virtualItemSize={ROW}
    defaultScrolled={{ id: "row_2200" }}
    renderBudget={{ initial: "100%", after: "150%" }}
  >
    <List.Items
      count={ROW_COUNT}
      itemSize={itemSize}
      itemsAction={itemsAction}
      renderItem={renderItem}
    />
  </List>
);

window.whenPageAtRest = whenPageAtRest;
window.jumpTo = (row) => {
  const listTop =
    document.querySelector(".navi_list").getBoundingClientRect().top +
    window.scrollY;
  window.scrollTo(0, listTop + row * ROW);
};
render(<App />, document.querySelector("#app"));
