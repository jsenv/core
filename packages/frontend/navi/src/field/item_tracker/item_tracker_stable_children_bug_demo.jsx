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
export const App = () => {
  const [counter, setCounter] = useState(0);
  const ItemTrackerProvider = useItemTrackerProvider();

  // Build children OUTSIDE the JSX — so the reference is stable across
  // re-renders caused by counter changes. This is what happens in
  // SuggestionListbox: `children` comes from the parent and doesn't change
  // when SuggestionListbox's own state changes.
  const stableChildren = (
    <ul>
      <Item value="Alpha" />
      <Item value="Beta" />
      <Item value="Gamma" />
    </ul>
  );

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
        Children are created once outside the render function (stable
        reference). When the parent's <em>own</em> state changes, Preact
        re-renders the parent and the provider, calls{" "}
        <code>tracker.reset()</code>, but skips the children because their vnode
        is the same object. No <code>registerItem()</code> calls happen →{" "}
        <code>items</code> is empty.
      </p>
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
        {stableChildren}
        <CountDisplay
          ItemTrackerProvider={ItemTrackerProvider}
          id="count-stable"
        />
      </ItemTrackerProvider>

      <button onClick={() => setCounter((c) => c + 1)}>
        Trigger parent state change (counter++)
      </button>

      <p style={{ color: "#888", fontSize: "13px" }}>
        After clicking the button, the count above turns{" "}
        <span style={{ color: "#f44747" }}>red and shows 0</span>. This
        demonstrates the bug: the DOM still has 3 items but the tracker thinks
        there are none.
      </p>
    </div>
  );
};
