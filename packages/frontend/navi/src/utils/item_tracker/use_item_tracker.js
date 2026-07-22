import { batch, signal } from "@preact/signals";
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
 *   const count = tracker.visibleCountSignal.value; // re-renders only when count changes
 *   return <span>{count} items</span>;
 * }
 * ```
 *
 * INTERNALS:
 *   - registrations: Map key → data, contains only visible items
 *   - idToKey: Map id → key, stable across renders
 *   - orderedKeys: number[] of visible item keys sorted by explicit order
 *   - keyToOrderedIndex: Map key → orderedKeys index, gives O(1) indexOf equivalent
 *   - keyToExplicitOrder: Map key → explicitly passed index, used to maintain sort order
 *   - allItemsSignal: signal(array), all items including hidden, ordered by explicit index
 *   - visibleItemsSignal: signal(array), non-hidden items only
 *   - countSignal: signal(number), count of all items including hidden
 *   - visibleCountSignal: signal(number), updated in microtask batch, only when count changes
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
  let tracker = trackerRef.current;
  if (!tracker) {
    trackerRef.current = tracker = createItemTracker((items) => {
      onChangeRef.current?.(items);
    });
  }
  // When code in useLayoutEffect of the caller wants to run the tracker must be in sync
  // without this layout effect the tracker might not have been synced yet and preact would call layout effect
  // before we had time to sync
  useLayoutEffect(() => {
    tracker._flushSync();
  });
  return tracker;
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

  const allRegistrations = new Map(); // key → data (all items including hidden)
  const allOrderedKeys = []; // all item keys sorted by explicit order
  const keyToAllOrderedIndex = new Map(); // key → index in allOrderedKeys

  const itemsSignal = signal([]);
  const visibleItemsSignal = signal([]);
  const countSignal = signal(0);
  const visibleCountSignal = signal(0);
  const noMatchCountSignal = signal(0);

  let notifyScheduled = false;
  const runNotify = () => {
    batch(() => {
      let someChange = false;

      const newCount = allKeys.size;
      const countModified = countSignal.peek() !== newCount;
      if (countModified) {
        countSignal.value = newCount;
        someChange = true;
      }

      // Build allItems and visibleItems in a single pass over allOrderedKeys.
      // Visible items are those without data.hidden or data.filtered — same
      // relative order as orderedKeys (syncItem already excludes both from
      // orderedKeys; this must match or consumers relying on visibleCountSignal
      // for virtual-scroll accounting, e.g. list.jsx's filler sizing, would
      // count filtered-out items as if they still took up space).
      const prevAllItems = itemsSignal.peek();
      const prevVisibleItems = visibleItemsSignal.peek();
      let allItemsChanged = prevAllItems.length !== allOrderedKeys.length;
      let visibleItemsChanged = false;
      const allItems = [];
      const visibleItems = [];
      let newNoMatchCount = 0;
      for (let i = 0; i < allOrderedKeys.length; i++) {
        const key = allOrderedKeys[i];
        const item = allRegistrations.get(key);
        allItems.push(item);
        // Compare by reference: catches any prop change (id, selected, disabled, …)
        if (!allItemsChanged && item !== prevAllItems[i]) {
          allItemsChanged = true;
        }
        if (item.match === false) {
          newNoMatchCount++;
        }
        if (!item.hidden && !item.filtered) {
          const visibleIdx = visibleItems.length;
          visibleItems.push(item);
          if (!visibleItemsChanged && item !== prevVisibleItems[visibleIdx]) {
            visibleItemsChanged = true;
          }
        }
      }

      const newVisibleCount = visibleItems.length;
      const visibleCountModified =
        visibleCountSignal.peek() !== newVisibleCount;
      if (visibleCountModified) {
        visibleCountSignal.value = newVisibleCount;
        someChange = true;
      }
      if (allItemsChanged) {
        itemsSignal.value = allItems;
        someChange = true;
      }
      if (visibleItemsChanged) {
        visibleItemsSignal.value = visibleItems;
        someChange = true;
      }
      const noMatchCountModified = noMatchCountSignal.peek() !== newNoMatchCount;
      if (noMatchCountModified) {
        noMatchCountSignal.value = newNoMatchCount;
        someChange = true;
      }
      if (someChange) {
        onChange?.();
      }
    });
  };

  const notify = () => {
    if (notifyScheduled) {
      return;
    }
    notifyScheduled = true;
    queueMicrotask(() => {
      if (!notifyScheduled) {
        return; // was already flushed synchronously
      }
      notifyScheduled = false;
      runNotify();
    });
  };

  const _flushSync = () => {
    if (!notifyScheduled) {
      return;
    }
    notifyScheduled = false;
    runNotify();
  };

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

  const insertAllKey = (key, explicitOrder) => {
    let lo = 0;
    let hi = allOrderedKeys.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (keyToExplicitOrder.get(allOrderedKeys[mid]) <= explicitOrder) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    allOrderedKeys.splice(lo, 0, key);
    for (let i = lo; i < allOrderedKeys.length; i++) {
      keyToAllOrderedIndex.set(allOrderedKeys[i], i);
    }
  };

  const removeAllKey = (key) => {
    const idx = keyToAllOrderedIndex.get(key);
    if (idx !== undefined) {
      allOrderedKeys.splice(idx, 1);
      keyToAllOrderedIndex.delete(key);
      for (let i = idx; i < allOrderedKeys.length; i++) {
        keyToAllOrderedIndex.set(allOrderedKeys[i], i);
      }
    }
  };

  // Register or update an item. data.hidden controls visibility.
  // explicitOrder is the caller-provided index that determines sort position.
  const syncItem = (key, index, data) => {
    if (data.role === "presentation") {
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
      allRegistrations.delete(key);
      removeAllKey(key);
      allKeys.delete(key);
      return;
    }

    // Maintain allRegistrations and allOrderedKeys for all non-presentation items.
    allRegistrations.set(key, data);
    allKeys.add(key);
    const currentAllIdx = keyToAllOrderedIndex.get(key);
    const previousOrder = keyToExplicitOrder.get(key);
    keyToExplicitOrder.set(key, index);
    if (currentAllIdx === undefined) {
      insertAllKey(key, index);
    } else if (previousOrder !== index) {
      allOrderedKeys.splice(currentAllIdx, 1);
      keyToAllOrderedIndex.delete(key);
      for (let i = currentAllIdx; i < allOrderedKeys.length; i++) {
        keyToAllOrderedIndex.set(allOrderedKeys[i], i);
      }
      insertAllKey(key, index);
    }

    if (data.filtered || data.hidden) {
      registrations.delete(key);
      const idx = keyToOrderedIndex.get(key);
      if (idx !== undefined) {
        orderedKeys.splice(idx, 1);
        keyToOrderedIndex.delete(key);
        for (let i = idx; i < orderedKeys.length; i++) {
          keyToOrderedIndex.set(orderedKeys[i], i);
        }
      }
      return;
    }

    registrations.set(key, data);
    const currentIdx = keyToOrderedIndex.get(key);
    if (currentIdx === undefined) {
      insertKey(key, index);
      return;
    }
    if (previousOrder === index) {
      return;
    }
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
    notify();

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
        allRegistrations.delete(key);
        removeAllKey(key);
        allKeys.delete(key);
        notify();
      };
    }, []);

    if (data.filtered || data.hidden || data.role === "presentation") {
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
    getTrackedItemByIndex,
    itemsSignal,
    visibleItemsSignal,
    countSignal,
    visibleCountSignal,
    noMatchCountSignal,
    _flushSync,
  };
};
