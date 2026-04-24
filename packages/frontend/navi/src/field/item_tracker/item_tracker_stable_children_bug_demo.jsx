/**
 * ItemTracker – Stable Children Bug Demo
 *
 * WHAT THIS DEMONSTRATES:
 *
 * The ItemTracker relies on every child calling tracker.registerItem() during
 * each render of their parent provider. The provider calls tracker.reset()
 * at the start of each render so that items are rebuilt fresh.
 *
 * THE BUG: when the Provider's parent re-renders (e.g. due to a state change)
 * but passes the *same* `children` prop reference, Preact skips re-rendering
 * the children. They don't call registerItem() again. The tracker is therefore
 * empty after reset(), even though the DOM still contains all the items.
 *
 * This is exactly what happens in SuggestionListbox: pressing ArrowDown
 * calls setKeyboardPointedValue() → SuggestionListbox re-renders →
 * ItemTrackerProvider renders (reset) → Suggestion wrappers are skipped
 * (their `children` JSX is stable) → ItemTrackerProvider.items === [].
 *
 * HOW TO REPRODUCE:
 *  1. The app renders a Provider with 3 items as children.
 *  2. The parent has a counter state. Pressing "Trigger parent state change"
 *     increments the counter, which re-renders the parent and the provider,
 *     but the children list is built outside the render tree (stable reference),
 *     so Preact skips the children.
 *  3. After the state change the layout effect reads ItemTrackerProvider.items
 *     and shows 0 instead of 3.
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
        After clicking, the count turns{" "}
        <span style={{ color: "#f44747" }}>red and shows 0</span>. Inner
        re-renders → tracker resets → children are skipped by Preact → items
        empty.
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
