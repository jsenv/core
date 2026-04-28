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
 *       {items.map((item, i) => (
 *         <Row key={item.id} id={item.id} index={i} hidden={item.hidden} value={item.value} tracker={tracker} />
 *       ))}
 *       <Count tracker={tracker} />
 *     </ul>
 *   );
 * }
 *
 * function Row({ id, index, hidden, value, tracker }) {
 *   const visibleIndex = tracker.useTrackItem({ id, index, hidden, value });
 *   if (visibleIndex === -1) return null;
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
 *   - orderedKeys: number[] of visible item keys sorted by explicit order
 *   - keyToOrderedIndex: Map key → orderedKeys index, gives O(1) indexOf equivalent
 *   - keyToExplicitOrder: Map key → explicitly passed index, used to maintain sort order
 *   - countSignal: signal(number), updated in microtask batch, only when count changes
 *   - propSignals: Map propName → signal(array), updated in microtask batch with element equality
 *   - onChangeRef: holds the latest onChange callback, called once per microtask batch
 *
 *   useTrackItem(id, data, index): registers the item with an explicitly provided index
 *   that determines its position among siblings. The caller (e.g. items.map) knows the
 *   correct order and passes it directly — no render-sequence deduction needed.
 *   Returns the visible rank (position among non-hidden items), or -1 when hidden.
 *   Signals and onChange are deferred to a microtask so multiple items updating
 *   in one commit cause only one notification.
 *
 *   getTrackedItemByIndex(index): synchronous O(1) lookup of a visible item by
 *   its visible rank. Returns undefined when index is out of range.
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
  // orderedKeys: visible item keys sorted by their explicitly provided index.
  const orderedKeys = []; // number[]
  // keyToOrderedIndex: O(1) equivalent of orderedKeys.indexOf(key).
  const keyToOrderedIndex = new Map(); // key → index in orderedKeys
  const allKeys = new Set(); // all registered keys including hidden
  const keyToExplicitOrder = new Map(); // key → explicitly passed index

  const countSignal = signal(0);
  const totalCountSignal = signal(0);
  const itemsSignal = signal([]);
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

      const newCount = orderedKeys.length;
      if (countSignal.peek() !== newCount) {
        countSignal.value = newCount;
      }

      const newTotalCount = allKeys.size;
      if (totalCountSignal.peek() !== newTotalCount) {
        totalCountSignal.value = newTotalCount;
      }

      for (const [propName, sig] of propSignals) {
        const prev = sig.peek();
        const next = orderedKeys.map((key) => registrations.get(key)[propName]);
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

      const items = orderedKeys.map((key) => registrations.get(key));
      itemsSignal.value = items;
      onChange?.(items);
    });
  };

  // Subscribes the calling component to the count signal.
  // Only re-renders when the visible item count changes.
  const useItemCount = () => countSignal.value;

  // Subscribes the calling component to a per-prop signal.
  // Only re-renders when the array of values for that prop changes.
  const useItemValues = (propName) => getPropSignal(propName).value;

  // Insert key into orderedKeys at the correct position based on explicitOrder.
  // Uses binary search for O(log n) insertion.
  const insertKey = (key, explicitOrder) => {
    let lo = 0;
    let hi = orderedKeys.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (keyToExplicitOrder.get(orderedKeys[mid]) <= explicitOrder) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    orderedKeys.splice(lo, 0, key);
    for (let i = lo; i < orderedKeys.length; i++) {
      keyToOrderedIndex.set(orderedKeys[i], i);
    }
  };

  // Register or update an item. data.hidden controls visibility.
  // explicitOrder is the caller-provided index that determines sort position.
  const syncItem = (key, index, data) => {
    if (data.hidden || data.role === "presentation") {
      registrations.delete(key);
      const idx = keyToOrderedIndex.get(key);
      if (idx !== undefined) {
        orderedKeys.splice(idx, 1);
        keyToOrderedIndex.delete(key);
        // Shift down indices for all keys after the removed position.
        for (let i = idx; i < orderedKeys.length; i++) {
          keyToOrderedIndex.set(orderedKeys[i], i);
        }
      }
      keyToExplicitOrder.delete(key);
      if (data.role !== "presentation") {
        allKeys.add(key);
      } else {
        allKeys.delete(key);
      }
      return;
    }
    registrations.set(key, data);
    allKeys.add(key);

    const currentIdx = keyToOrderedIndex.get(key);
    const previousOrder = keyToExplicitOrder.get(key);
    keyToExplicitOrder.set(key, index);

    if (currentIdx === undefined) {
      // New item: insert at the position matching its explicit order.
      insertKey(key, index);
      return;
    }
    if (previousOrder === index) {
      // Same order, data updated in place — no repositioning needed.
      return;
    }
    // Order changed: remove from current position and reinsert.
    orderedKeys.splice(currentIdx, 1);
    keyToOrderedIndex.delete(key);
    for (let i = currentIdx; i < orderedKeys.length; i++) {
      keyToOrderedIndex.set(orderedKeys[i], i);
    }
    insertKey(key, index);
  };

  // Register an item. data.hidden controls visibility.
  // explicitOrder is the caller-provided index (e.g. from items.map((item, i) => ...))
  // that determines this item's position among siblings.
  // Returns the item's visible rank among non-hidden items, or -1 when hidden.
  const useTrackItem = (data) => {
    const { id, index } = data;
    if (!idToKey.has(id)) {
      idToKey.set(id, keyCounter++);
    }
    const key = idToKey.get(id);

    syncItem(key, index, data);

    useLayoutEffect(() => {
      syncItem(key, index, data);
      notify();
    });

    useLayoutEffect(() => {
      return () => {
        registrations.delete(key);
        const idx = keyToOrderedIndex.get(key);
        if (idx !== undefined) {
          orderedKeys.splice(idx, 1);
          keyToOrderedIndex.delete(key);
          for (let i = idx; i < orderedKeys.length; i++) {
            keyToOrderedIndex.set(orderedKeys[i], i);
          }
        }
        keyToExplicitOrder.delete(key);
        allKeys.delete(key);
        notify();
      };
    }, []);

    if (data.hidden || data.role === "presentation") {
      return -1;
    }
    return keyToOrderedIndex.get(key) ?? -1;
  };

  const getTrackedItemByIndex = (index) => {
    const key = orderedKeys[index];
    if (key === undefined) {
      return undefined;
    }
    return registrations.get(key);
  };

  return {
    useTrackItem,
    useItems: () => itemsSignal.value,
    useItemCount,
    useItemValues,
    getTrackedItemByIndex,
    countSignal,
    totalCountSignal,
  };
};
