/*
 * A thread of one-line items followed by cards, scrolling the page: the past
 * one line each, what is ahead a card seven times as tall. `virtualItemSize`
 * is the one-line item, the worst case docs/scroll.md asks for.
 *
 * `window.step(delta)` scrolls the page by `delta` the way a script does — a
 * scroll the list must not write into (see scroll_in_flight.js), like a fling
 * on iOS — and says, once the list has framed its window again, how much what
 * stands above the screen changed: the rows on screen moved by `move`, the
 * scroll by `dy`, and `move + dy` is what nobody scrolled. The list correcting
 * it with a write shows in `correction`; left alone, it is what the eye sees.
 *
 * The run carries `findText`: the fillers hold the text of their items for
 * Cmd/Ctrl + F, one line per item. `window.checkFindLines()` compares where
 * each line stands with where its item stood the last time it was drawn.
 */

import { List } from "@jsenv/navi";
import { render } from "preact";

const LINE_COUNT = 30;
const CARD_COUNT = 90;
const LINE_HEIGHT = 38;
const CARD_HEIGHT = 290;

const ITEMS = [];
let index = 0;
while (index < LINE_COUNT + CARD_COUNT) {
  ITEMS.push({
    id: `item_${index}`,
    label: `item ${index}`,
    card: index >= LINE_COUNT,
  });
  index++;
}

const renderItem = (item) => (
  <List.Item style={{ height: `${item.card ? CARD_HEIGHT : LINE_HEIGHT}px` }}>
    {item.label}
  </List.Item>
);

const findText = (item) => item.label;

const searchParams = new URLSearchParams(window.location.search);
const openAt = searchParams.get("open") || undefined;

const App = () => {
  return (
    <div id="thread">
      <List
        scroller="document"
        borderWidth="0"
        virtualItemSize={LINE_HEIGHT}
        renderBudget="150%"
        defaultScrolled={openAt}
      >
        <List.Items items={ITEMS} renderItem={renderItem} findText={findText} />
      </List>
    </div>
  );
};

render(<App />, document.querySelector("#app"));

// Where each item stood in the document the last time it was drawn.
const drawnTopByIndex = new Map();
const recordDrawnRows = () => {
  for (const rowEl of document.querySelectorAll(
    "#thread [navi-list-item-real]",
  )) {
    drawnTopByIndex.set(
      Number(rowEl.getAttribute("navi-list-item-index")),
      rowEl.getBoundingClientRect().top + window.scrollY,
    );
  }
};
const readRowsOnScreen = () => {
  const rows = new Map();
  for (const rowEl of document.querySelectorAll(
    "#thread [navi-list-item-real]",
  )) {
    const rect = rowEl.getBoundingClientRect();
    if (rect.bottom > 0 && rect.top < window.innerHeight) {
      rows.set(rowEl.getAttribute("navi-list-item-real"), rect.top);
    }
  }
  return rows;
};
const nextFrames = (count) =>
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

window.step = async (delta) => {
  const scrollerEl = document.scrollingElement;
  const rowsBefore = readRowsOnScreen();
  const scrollBefore = scrollerEl.scrollTop;
  scrollerEl.scrollTop = scrollBefore + delta;
  await nextFrames(6);
  recordDrawnRows();
  const rowsAfter = readRowsOnScreen();
  const moves = [];
  for (const [id, top] of rowsBefore) {
    if (rowsAfter.has(id)) {
      moves.push(rowsAfter.get(id) - top);
    }
  }
  moves.sort((a, b) => a - b);
  const move = moves[moves.length >> 1];
  const dy = scrollerEl.scrollTop - scrollBefore;
  return { shift: move + dy, correction: dy - delta };
};
window.readOpening = () => {
  const scrollerEl = document.scrollingElement;
  return {
    items_drawn: document.querySelectorAll("#thread [navi-list-item-real]")
      .length,
    at_the_end:
      scrollerEl.scrollTop >= scrollerEl.scrollHeight - window.innerHeight - 1,
  };
};
window.readTopRow = () => {
  let top = null;
  for (const [id, offset] of readRowsOnScreen()) {
    if (offset >= 0 && (top === null || offset < top.offset)) {
      top = { id, offset: Math.round(offset) };
    }
  }
  return top;
};
window.checkFindLines = () => {
  let lastDrawn = -1;
  for (const rowEl of document.querySelectorAll(
    "#thread [navi-list-item-real]",
  )) {
    lastDrawn = Number(rowEl.getAttribute("navi-list-item-index"));
  }
  let checked = 0;
  let off = 0;
  for (const fillerEl of document.querySelectorAll(
    "#thread [navi-virtual-filler]",
  )) {
    let index =
      fillerEl.getAttribute("navi-virtual-filler") === "before"
        ? 0
        : lastDrawn + 1;
    for (const chunkEl of fillerEl.children) {
      const lineCount = Number(
        chunkEl.style.getPropertyValue("--x-find-line-count"),
      );
      const lineSize = parseFloat(
        chunkEl.style.getPropertyValue("--x-find-line-size"),
      );
      const chunkTop = chunkEl.getBoundingClientRect().top + window.scrollY;
      let line = 0;
      while (line < lineCount) {
        const drawnTop = drawnTopByIndex.get(index);
        if (drawnTop !== undefined) {
          checked++;
          if (Math.abs(chunkTop + line * lineSize - drawnTop) > 1) {
            off++;
          }
        }
        line++;
        index++;
      }
    }
  }
  return { checked, off };
};
// What changed above the screen frame after frame, between `startFrames()`
// and `stopFrames()`, measured like `step` does: the frames where the rows
// jump by more than 100px while the scroll does not take it back, the eye
// sees the content replaced.
let frameSampler = null;
window.startFrames = () => {
  const sampler = { frames: [], stopped: false };
  frameSampler = sampler;
  const sample = () => {
    if (sampler.stopped) {
      return;
    }
    sampler.frames.push({ scrollY: window.scrollY, rows: readRowsOnScreen() });
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
};
window.stopFrames = () => {
  frameSampler.stopped = true;
  const { frames } = frameSampler;
  let jumps = 0;
  let index = 1;
  while (index < frames.length) {
    const previous = frames[index - 1];
    const frame = frames[index];
    const moves = [];
    for (const [id, top] of previous.rows) {
      if (frame.rows.has(id)) {
        moves.push(frame.rows.get(id) - top);
      }
    }
    if (moves.length === 0) {
      jumps++;
    } else {
      moves.sort((a, b) => a - b);
      const move = moves[moves.length >> 1];
      const shift = move + frame.scrollY - previous.scrollY;
      if (Math.abs(shift) > 100 && Math.abs(move) > Math.abs(shift) - 60) {
        jumps++;
      }
    }
    index++;
  }
  return { jumps, scrollY: window.scrollY };
};
window.readScroll = () => document.scrollingElement.scrollTop;
window.jumpTo = async (top) => {
  document.scrollingElement.scrollTop = top;
  await nextFrames(10);
};
window.waitFrames = nextFrames;
