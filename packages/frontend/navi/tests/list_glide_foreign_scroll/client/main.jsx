/*
 * A list of 1500 items, a third of them taller than `virtualItemSize` says,
 * and a button sending it to item 1200 with a glide (--navi-scroll:smooth).
 * `?scroller=document` scrolls the page, `?scroller=self` the list's own box.
 *
 * `window.scrollerEl()` is the box that scrolls.
 */

import { Button, List } from "@jsenv/navi";
import { render } from "preact";

const scrollerMode =
  new URL(window.location.href).searchParams.get("scroller") || "document";
const ITEMS = [];
let index = 0;
while (index < 1500) {
  ITEMS.push({ id: `item_${index}`, label: `item ${index}` });
  index++;
}
const heightOf = (itemIndex) => (itemIndex % 3 === 0 ? 150 : 44);
const renderItem = (item, itemIndex) => (
  <List.Item
    style={{ height: `${heightOf(itemIndex)}px`, boxSizing: "border-box" }}
  >
    {item.label}
  </List.Item>
);

const App = () => (
  <div>
    <div style={{ position: "fixed", top: 0, right: 0, zIndex: 10 }}>
      <Button
        id="glide"
        command="--navi-scroll:smooth"
        commandFor="feed"
        value={{ id: "item_1200" }}
      >
        glide
      </Button>
    </div>
    <List
      id="feed"
      scroller={scrollerMode === "document" ? "document" : undefined}
      maxHeight={scrollerMode === "document" ? undefined : "600px"}
      virtualItemSize={44}
      border="none"
    >
      <List.Items items={ITEMS} renderItem={renderItem} />
    </List>
  </div>
);

window.scrollerEl = () =>
  scrollerMode === "document"
    ? document.scrollingElement
    : document.querySelector(".navi_list_scroll_container");
render(<App />, document.querySelector("#app"));
