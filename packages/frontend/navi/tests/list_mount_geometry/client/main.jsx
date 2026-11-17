/*
 * A list of members, the shape of the report this comes from: rows of 58px,
 * the page scrolling, no height of the list's own and no `scroller` — the list
 * measures which box scrolls it. 112 rows, 14 drawn at first: the rows drawn
 * stand shorter than a phone's screen, the whole list several screens taller.
 *
 * The url picks what is mounted:
 * - `case=long`: that list;
 * - `case=long&open=<id>`: the same, opening on that row (`defaultScrolled`);
 * - `case=empty`: no rows, and the list's `fallback` saying so;
 * - `case=grow`: six rows, the second of which `window.grow(px)` makes taller
 *   from inside the row: the list is resized, not rendered again.
 *
 * `window.firstCommit` is what the list looks like at the end of its first
 * commit, read by the component around it, whose layout effect runs after all
 * of the list's. `window.readList()` reads the same at any later time.
 * `window.errors` holds what reached the window's error event: a
 * ResizeObserver loop among them, which no exception carries.
 */

import { signal } from "@preact/signals";
import { List } from "@jsenv/navi";
import { render } from "preact";
import { useLayoutEffect } from "preact/hooks";

window.errors = [];
window.addEventListener("error", (event) => {
  window.errors.push(event.message);
});

const params = new URLSearchParams(window.location.search);
const caseName = params.get("case");
const openAt = params.get("open") || undefined;

const ROW_HEIGHT = 58;
const MEMBERS = [];
let index = 0;
while (index < 112) {
  MEMBERS.push({ id: `member_${index}`, name: `member ${index}` });
  index++;
}

window.fallbackMounts = 0;
const Fallback = () => {
  useLayoutEffect(() => {
    window.fallbackMounts++;
  }, []);
  return <div data-fallback="">nobody here yet</div>;
};

const renderMember = (member) => (
  <List.Item key={member.id} style={{ height: `${ROW_HEIGHT}px` }}>
    {member.name}
  </List.Item>
);

const extraHeightSignal = signal(0);
const GrowingRow = () => (
  <List.Item
    id="growing"
    style={{ height: `${ROW_HEIGHT + extraHeightSignal.value}px` }}
  >
    growing
  </List.Item>
);
window.grow = (px) => {
  extraHeightSignal.value = px;
};

const readList = () => {
  const boxEl = document.querySelector("#list_box");
  return {
    height: Math.round(boxEl.getBoundingClientRect().height),
    rows_drawn: boxEl.querySelectorAll("[navi-list-item-real]").length,
    fallback_on_screen: Boolean(boxEl.querySelector("[data-fallback]")),
    fallback_mounts: window.fallbackMounts,
  };
};
window.readList = readList;

const FirstCommit = ({ children }) => {
  useLayoutEffect(() => {
    window.firstCommit = readList();
  }, []);
  return <div id="list_box">{children}</div>;
};

const App = () => {
  if (caseName === "grow") {
    return (
      <FirstCommit>
        <List borderWidth="0" fallback={<Fallback />}>
          <List.Item id="row_a" style={{ height: `${ROW_HEIGHT}px` }}>
            row a
          </List.Item>
          <GrowingRow />
          <List.Item id="row_c" style={{ height: `${ROW_HEIGHT}px` }}>
            row c
          </List.Item>
          <List.Item id="row_d" style={{ height: `${ROW_HEIGHT}px` }}>
            row d
          </List.Item>
          <List.Item id="row_e" style={{ height: `${ROW_HEIGHT}px` }}>
            row e
          </List.Item>
          <List.Item id="row_f" style={{ height: `${ROW_HEIGHT}px` }}>
            row f
          </List.Item>
        </List>
      </FirstCommit>
    );
  }
  return (
    <FirstCommit>
      <List
        borderWidth="0"
        renderBudget={{ initial: 14, after: 30 }}
        defaultScrolled={openAt ? { id: openAt } : undefined}
        fallback={<Fallback />}
      >
        <List.Items
          items={caseName === "empty" ? [] : MEMBERS}
          renderItem={renderMember}
        />
      </List>
    </FirstCommit>
  );
};

render(<App />, document.querySelector("#app"));

// The row nearest the top of the screen, and how far below it.
window.readTopRow = () => {
  let top = null;
  for (const rowEl of document.querySelectorAll("[navi-list-item-real]")) {
    const offset = rowEl.getBoundingClientRect().top;
    if (offset >= 0 && (top === null || offset < top.offset)) {
      top = { id: rowEl.getAttribute("navi-list-item-real"), offset };
    }
  }
  return top ? `${top.id} at ${Math.round(top.offset)}px` : null;
};
window.waitFrames = (count) =>
  new Promise((resolve) => {
    let left = count;
    const next = () => {
      if (left === 0) {
        resolve();
        return;
      }
      left--;
      requestAnimationFrame(next);
    };
    next();
  });
