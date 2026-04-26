/**
 * ItemTracker – Stable Children Bug
 *
 * THE BUG: when the tracker's parent re-renders but passes the same `children`
 * prop reference, Preact skips re-rendering those children (bailout). They
 * don't call registerItem() again. After reset(), renderCount is 0 and
 * committedItems is only updated later in child effects.
 *
 * Reading committedItems.length in a parent layout effect returns 0 (stale)
 * even though the items are still in the DOM.
 *
 * This is the EXACT scenario in list.jsx when renderWindow state changes
 * (e.g. scrolling): ListControlled re-renders, passes the same children prop
 * to UnorderedList → ItemTrackerProvider → stable children bail out.
 * The filler effect in ListControlled reads committedItems.length = 0 (stale).
 *
 * Scenario B below shows the bug: after clicking the button, the count
 * should stay 3 but drops to 0 (renderCount) then recovers to 3 next render.
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
