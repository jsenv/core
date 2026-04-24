/**
 * Item Tracker – Filter Two-Pass Demo
 *
 * Reproduces the two-pass render problem that appears when:
 * 1. Items are passed as `children` props to the Provider (so Preact may bail
 *    out re-rendering them on a parent state change).
 * 2. A filter is applied that changes which items are visible.
 *
 * EXPECTED (ideal): after a filter change, the provider's `visibleCount` is
 * correct on the very first render pass.
 *
 * ACTUAL: `visibleCount` reads the old (stale) committed map in the first
 * pass, because the Suggestion/Item children haven't re-rendered yet — they
 * run their commit/decommit effects *after* the provider's own layoutEffect.
 * A second render pass then corrects everything.
 *
 * HOW TO OBSERVE:
 * - Open the browser console.
 * - Type "a" in the filter input.
 * - Watch the logs: you will see two passes. In pass 1 the "Stat" component
 *   reads a stale visibleCount. In pass 2 it reads the correct count.
 * - The `[STAT] visibleCount` value shown in the console on pass 1 will be
 *   wrong (e.g. "10" when only 3 items match "a").
 */

import { useLayoutEffect, useState } from "preact/hooks";
import { createItemTracker } from "./item_tracker.jsx";

const ITEMS = [
  "Alpha",
  "Bravo",
  "Charlie",
  "Delta",
  "Echo",
  "Foxtrot",
  "Golf",
  "Hotel",
  "India",
  "Juliet",
];

const [useItemTrackerProvider, useTrackItem] = createItemTracker({
  filter: (data) => !data.hidden,
});

// ---------------------------------------------------------------------------
// Item — hides itself when it doesn't match the filter
// ---------------------------------------------------------------------------
const Item = ({ value, filter }) => {
  const hidden = filter
    ? !value.toLowerCase().includes(filter.toLowerCase())
    : false;
  useTrackItem(value, { value, hidden });
  if (hidden) {
    return null;
  }
  return <li>{value}</li>;
};

// ---------------------------------------------------------------------------
// Stat — reads visibleCount in a layoutEffect (same as SuggestionListbox filler)
// ---------------------------------------------------------------------------
const Stat = ({ ItemTrackerProvider }) => {
  useLayoutEffect(() => {
    const count = ItemTrackerProvider.visibleCount;
    console.debug(`[STAT] visibleCount=${count}`);
    const el = document.getElementById("stat-count");
    if (el) {
      el.textContent = String(count);
    }
  });
  return (
    <div className="stat">
      Visible count (read in layoutEffect): <b id="stat-count">?</b>
    </div>
  );
};

// ---------------------------------------------------------------------------
// ListWrapper — owns the Provider and passes items as children props.
// This is the key: children are passed as props from App, so Preact may bail
// out on their re-render when only ListWrapper state changes.
// ---------------------------------------------------------------------------
const ListWrapper = ({ children, ItemTrackerProvider }) => {
  console.debug("[ListWrapper] render");
  return (
    <ItemTrackerProvider>
      <ul>{children}</ul>
      <Stat ItemTrackerProvider={ItemTrackerProvider} />
    </ItemTrackerProvider>
  );
};

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export const App = () => {
  const [filter, setFilter] = useState("");
  const ItemTrackerProvider = useItemTrackerProvider();

  console.debug(`[App] render filter="${filter}"`);

  return (
    <div>
      <h2>Item Tracker – Filter Two-Pass Demo</h2>
      <p style="font-size:13px;color:#666">
        Type in the filter to see the two-pass render in the console. The{" "}
        <code>visibleCount</code> shown after pass 1 will be stale.
      </p>
      <input
        type="text"
        placeholder="Filter items…"
        value={filter}
        onInput={(e) => setFilter(e.currentTarget.value)}
      />
      <ListWrapper ItemTrackerProvider={ItemTrackerProvider}>
        {ITEMS.map((value) => (
          <Item key={value} value={value} filter={filter} />
        ))}
      </ListWrapper>
    </div>
  );
};
