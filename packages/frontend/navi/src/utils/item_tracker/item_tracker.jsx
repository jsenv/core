import { signal } from "@preact/signals";
import { useLayoutEffect, useRef } from "preact/hooks";

/*
 * useItemTracker() — hook that creates a stable item tracker for the lifetime
 * of the host component.
 *
 * USAGE:
 * ```jsx
 * function ListControlled({ items }) {
 *   const tracker = useItemTracker({
 *     onChange: () => console.log("items changed"),
 *   });
 *
 *   return (
 *     <ul>
 *       {items.map((item) => (
 *         <Row key={item.id} id={item.id} hidden={item.hidden} value={item.value} tracker={tracker} />
 *       ))}
 *       <Count tracker={tracker} />
 *     </ul>
 *   );
 * }
 *
 * function Row({ id, hidden, value, tracker }) {
 *   const index = tracker.useTrackItem(id, { hidden, value });
 *   if (index === -1) return null;
 *   return <li>{value}</li>;
 * }
 *
 * function Count({ tracker }) {
 *   const count = tracker.useItemCount(); // re-renders only when count changes
 *   return <span>{count} items</span>;
 * }
 *
 * function Values({ tracker }) {
 *   const values = tracker.useItemValues("value"); // re-renders only when values change
 *   return <span>{values.join(", ")}</span>;
 * }
 * ```
 *
 * INTERNALS:
 *   - registrations: Map key → data, contains only visible items
 *   - idToKey: Map id → key, stable across renders
 *   - sortedKeys: number[] of visible item keys kept sorted by visual order:
 *       when data.order is provided it is used as the sort key;
 *       otherwise the auto-incremented insertion key is used so natural
 *       (JSX declaration) order is preserved.
 *   - countSignal: signal(number), updated in microtask batch, only when count changes
 *   - propSignals: Map propName → signal(array), updated in microtask batch with element equality
 *   - onChangeRef: holds the latest onChange callback, called once per microtask batch
 *
 *   useTrackItem: updates registrations + sortedKeys synchronously during the
 *   render phase so index (= bisect position) is correct for the same commit.
 *   Signals and onChange are deferred to a microtask so multiple items updating
 *   in one commit cause only one notification.
 *
 *   getTrackedItemByIndex(index): synchronous O(1) lookup of a visible item by
 *   its sorted index. Returns undefined when index is out of range.
 */

export const useItemTracker = ({ onChange } = {}) => {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const trackerRef = useRef(null);
  if (!trackerRef.current) {
    trackerRef.current = createItemTracker((items) => {
      onChangeRef.current?.(items);
    });
  }
  return trackerRef.current;
};

const createItemTracker = (onChange) => {
  const registrations = new Map(); // key → data (visible items only)
  const idToKey = new Map(); // id → insertion key (stable, auto-incremented)
  let keyCounter = 0;
  // sortedKeys: sorted by each item's visual sort value.
  // The visual sort value is data.order when provided, otherwise the insertion key.
  // Storing { sortValue, key } pairs so we can bisect by sortValue.
  const sortedKeys = []; // { sortValue: number, key: number }[]

  const bisect = (sortValue) => {
    let lo = 0;
    let hi = sortedKeys.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sortedKeys[mid].sortValue < sortValue) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    return lo;
  };

  const insertKey = (sortValue, key) => {
    sortedKeys.splice(bisect(sortValue), 0, { sortValue, key });
  };

  const removeKey = (key) => {
    const idx = sortedKeys.findIndex((entry) => entry.key === key);
    if (idx !== -1) {
      sortedKeys.splice(idx, 1);
    }
  };

  const countSignal = signal(0);
  const propSignals = new Map(); // propName → signal(array)

  const getPropSignal = (propName) => {
    if (!propSignals.has(propName)) {
      propSignals.set(propName, signal([]));
    }
    return propSignals.get(propName);
  };

  let notifyScheduled = false;
  const notify = () => {
    if (notifyScheduled) {
      return;
    }
    notifyScheduled = true;
    queueMicrotask(() => {
      notifyScheduled = false;

      const newCount = sortedKeys.length;
      if (countSignal.peek() !== newCount) {
        countSignal.value = newCount;
      }

      for (const [propName, sig] of propSignals) {
        const prev = sig.peek();
        const next = sortedKeys.map(
          (entry) => registrations.get(entry.key)[propName],
        );
        let changed = prev.length !== next.length;
        if (!changed) {
          for (let i = 0; i < next.length; i++) {
            if (prev[i] !== next[i]) {
              changed = true;
              break;
            }
          }
        }
        if (changed) {
          sig.value = next;
        }
      }

      onChange?.(sortedKeys.map((entry) => registrations.get(entry.key)));
    });
  };

  // Subscribes the calling component to the count signal.
  // Only re-renders when the visible item count changes.
  const useItemCount = () => countSignal.value;

  // Subscribes the calling component to a per-prop signal.
  // Only re-renders when the array of values for that prop changes.
  const useItemValues = (propName) => getPropSignal(propName).value;

  // Register an item. data.hidden controls visibility.
  // Returns the item's index among visible items, or -1 when hidden.
  // sortedOrders is updated synchronously so the index is accurate for this
  // commit; signals are deferred to a microtask batch.
  const syncItem = (key, data) => {
    if (data.hidden || data.role === "presentation") {
      registrations.delete(key);
      removeKey(key);
    } else {
      const newSortValue = data.order !== undefined ? data.order : key;
      // Remove and re-insert when sort value changed or not yet present.
      const existingIdx = sortedKeys.findIndex((e) => e.key === key);
      if (
        existingIdx !== -1 &&
        sortedKeys[existingIdx].sortValue !== newSortValue
      ) {
        sortedKeys.splice(existingIdx, 1);
        insertKey(newSortValue, key);
      } else if (existingIdx === -1) {
        insertKey(newSortValue, key);
      }
      registrations.set(key, data);
    }
  };

  const useTrackItem = (id, data) => {
    if (!idToKey.has(id)) {
      idToKey.set(id, keyCounter++);
    }
    const key = idToKey.get(id);

    // Sync update so index is correct during this render
    syncItem(key, data);

    useLayoutEffect(() => {
      syncItem(key, data);
      notify();
    });

    useLayoutEffect(() => {
      return () => {
        registrations.delete(key);
        removeKey(key);
        notify();
      };
    }, []);

    if (data.hidden || data.role === "presentation") {
      return -1;
    }
    return sortedKeys.findIndex((e) => e.key === key);
  };

  const getTrackedItemByIndex = (index) => {
    const entry = sortedKeys[index];
    if (entry === undefined) {
      return undefined;
    }
    return registrations.get(entry.key);
  };

  return {
    useTrackItem,
    useItemCount,
    useItemValues,
    getTrackedItemByIndex,
    countSignal,
  };
};
