/**
 * ItemTracker – Stable Children Bug (regression test)
 *
 * This file was created to reproduce and diagnose a bug in ItemTracker, and
 * now serves as a regression test to ensure it stays fixed.
 *
 * THE BUG (was): when the Provider's parent re-renders due to its own state
 * change but passes the same `children` prop reference, Preact skips
 * re-rendering the children. They don't call registerItem() again. The tracker
 * was therefore empty after reset(), even though the DOM still contained all
 * the items. Reading ItemTrackerProvider.items in a layout effect would return
 * [] instead of the actual items.
 *
 * This is exactly what happened in SuggestionListbox: pressing ArrowDown
 * called setKeyboardPointedValue() → SuggestionListbox re-rendered →
 * ItemTrackerProvider rendered (reset) → Suggestion wrappers were skipped
 * (their `children` JSX is stable) → ItemTrackerProvider.items === [] →
 * keyboard navigation broke.
 *
 * THE FIX: per-item useLayoutEffect hooks maintain a `committedItems` snapshot
 * independently of renderItems. Bailout → no item effects fire → committedItems
 * unchanged. Genuine unmount → decommitItem cleanup → committedItems updated.
 *
 * Scenario B below should always show 3 — even after clicking the button.
 */

import { useLayoutEffect, useState } from "preact/hooks";
import { createItemTracker } from "./item_tracker.jsx";

const [useItemTrackerProvider, useTrackItem] = createItemTracker();

// ---------------------------------------------------------------------------
// Item — registers itself during render
// ---------------------------------------------------------------------------
const Item = ({ value }) => {
  useTrackItem({ value });
  return <li>{value}</li>;
};

// ---------------------------------------------------------------------------
// Consumer that lives inside the same component as the provider — reads
// ItemTrackerProvider.items in a layout effect and shows the count.
// ---------------------------------------------------------------------------
const CountDisplay = ({ ItemTrackerProvider, id }) => {
  useLayoutEffect(() => {
    const items = ItemTrackerProvider.items;
    const el = document.getElementById(id);
    if (el) {
      const count = items.length;
      el.textContent = String(count);
      el.className = count === 0 ? "bug" : "ok";
    }
  });
  return null;
};

const ItemList = ({ ItemTrackerProvider, label }) => {
  return (
    <div>
      <ItemTrackerProvider>
        <ul>
          <Item value="Alpha" />
          <Item value="Beta" />
          <Item value="Gamma" />
        </ul>
        <CountDisplay
          ItemTrackerProvider={ItemTrackerProvider}
          id={`count-${label}`}
        />
      </ItemTrackerProvider>
    </div>
  );
};

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

// Inner component: owns state and the tracker. Children come from its parent
// (Outer), so when Inner re-renders due to its own state change, the children
// vnode reference is the same → Preact skips re-rendering them.
const Inner = ({ children }) => {
  const [counter, setCounter] = useState(0);
  const ItemTrackerProvider = useItemTrackerProvider();

  return (
    <div>
      <p>
        Counter: <strong>{counter}</strong>
      </p>
      <p>
        Items seen in layout effect:{" "}
        <span id="count-stable" className="ok">
          ?
        </span>{" "}
        (expected: 3, becomes 0 after state change)
      </p>

      <ItemTrackerProvider>
        {children}
        <CountDisplay
          ItemTrackerProvider={ItemTrackerProvider}
          id="count-stable"
        />
      </ItemTrackerProvider>

      <button onClick={() => setCounter((c) => c + 1)}>
        Trigger Inner state change (counter++)
      </button>

      <p style={{ color: "#888", fontSize: "13px" }}>
        Count should stay <strong>3</strong> after clicking. If it drops to 0
        the bug has regressed.
      </p>
    </div>
  );
};

// Outer component: renders the children JSX. It does NOT re-render when Inner's
// state changes, so the children vnode reference passed to Inner is stable.
const Outer = () => {
  return (
    <Inner>
      <ul>
        <Item value="Alpha" />
        <Item value="Beta" />
        <Item value="Gamma" />
      </ul>
    </Inner>
  );
};

export const App = () => {
  return (
    <div>
      <h2>Setup</h2>
      <p>
        There are 3 items (<code>Alpha</code>, <code>Beta</code>,{" "}
        <code>Gamma</code>) registered via <code>useTrackItem</code>. A layout
        effect reads <code>ItemTrackerProvider.items.length</code> after each
        render.
      </p>

      <h2>Scenario A — children re-render with parent (no bug)</h2>
      <p>
        Children are inlined in the JSX. Every time the parent re-renders,
        Preact also re-renders the children → they call{" "}
        <code>registerItem()</code> again → items are populated correctly.
      </p>
      <p>
        Items seen in layout effect:{" "}
        <span id="count-inline" className="ok">
          ?
        </span>{" "}
        (expected: 3)
      </p>
      <ItemList ItemTrackerProvider={useItemTrackerProvider()} label="inline" />

      <hr />

      <h2>Scenario B — stable children (THE BUG)</h2>
      <p>
        Children are created in an outer component and passed as props to an
        inner component that owns state + the tracker. When the inner
        component's state changes, Preact re-renders it and calls{" "}
        <code>tracker.reset()</code>, but skips the children because their vnode
        reference is unchanged. No <code>registerItem()</code> calls happen →{" "}
        <code>items</code> is empty.
      </p>

      <Outer />
    </div>
  );
};
