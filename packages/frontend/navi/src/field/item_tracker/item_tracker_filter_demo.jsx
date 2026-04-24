/**
 * Item Tracker – Filter Demo
 *
 * Verifies that visibleCount (read as ItemTrackerProvider.items.length) is
 * always correct in the same render pass as the filter change.
 *
 * The fix: expose `items` as a live array reference. By the time any sibling
 * or ancestor layoutEffect reads it, all Item children have already run their
 * own commit/decommit effects (bottom-up ordering) — so items.length is
 * already accurate. No snapshot ref needed.
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
    // items is a live array: by the time this effect fires (after Item effects,
    // bottom-up), it already reflects the current filter.
    const count = ItemTrackerProvider.items.length;
    console.debug(`[STAT] items.length=${count}`);
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
        Type in the filter. The <code>items.length</code> in the console should
        always match the displayed items — in a single render pass.
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
