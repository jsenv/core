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
 *   - orderedKeys: number[] of visible item keys in JSX render order
 *   - keyToOrderedIndex: Map key → orderedKeys index, gives O(1) indexOf equivalent
 *   - renderPhaseOrder: Map key → render index for the current pass (Map for O(1) has/get/set)
 *       Built incrementally as items call syncItem in JSX order.
 *       Cleared in the notify microtask after all layout effects have run.
 *       First occurrence wins — layout-effect re-calls are skipped.
 *   - countSignal: signal(number), updated in microtask batch, only when count changes
 *   - propSignals: Map propName → signal(array), updated in microtask batch with element equality
 *   - onChangeRef: holds the latest onChange callback, called once per microtask batch
 *
 *   useTrackItem: updates registrations + orderedKeys synchronously during the
 *   render phase so index is correct for the same commit.
 *   When an item changes position (e.g. useSearch reorders), it is moved with
 *   two splices and only the affected keyToOrderedIndex range is updated.
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
  // orderedKeys: visible item keys in JSX render order.
  const orderedKeys = []; // number[]
  // keyToOrderedIndex: O(1) equivalent of orderedKeys.indexOf(key).
  // Kept in sync on every structural change (insert / remove / move).
  const keyToOrderedIndex = new Map(); // key → index in orderedKeys
  const allKeys = new Set(); // all registered keys including hidden
  // renderPhaseOrder: key → render index for the current pass.
  // Built incrementally as items call syncItem in JSX order.
  // Map gives O(1) has/set/get vs the O(n) includes on a plain array.
  // First occurrence wins — layout-effect re-calls are skipped via has().
  // Cleared in the notify microtask after all layout effects have run.
  const renderPhaseOrder = new Map();

  const countSignal = signal(0);
  const totalCountSignal = signal(0);
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
      // orderedKeys is kept correct synchronously — just clear the render pass map.
      renderPhaseOrder.clear();

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

      onChange?.(orderedKeys.map((key) => registrations.get(key)));
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
  // orderedKeys is updated synchronously so the index is accurate for this
  // commit; signals are deferred to a microtask batch.
  const syncItem = (key, data) => {
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
      if (data.role !== "presentation") {
        allKeys.add(key);
      } else {
        allKeys.delete(key);
      }
    } else {
      if (!keyToOrderedIndex.has(key)) {
        keyToOrderedIndex.set(key, orderedKeys.length);
        orderedKeys.push(key);
      }
      registrations.set(key, data);
      allKeys.add(key);
      // Record render index for this pass (first occurrence wins;
      // layout-effect re-calls are skipped because the entry already exists).
      if (!renderPhaseOrder.has(key)) {
        renderPhaseOrder.set(key, renderPhaseOrder.size);
      }
      // Move key to its render-order position so that keyToOrderedIndex is
      // accurate within this render pass. targetIdx equals the number of items
      // seen before this one in the current pass.
      const targetIdx = renderPhaseOrder.get(key);
      const currentIdx = keyToOrderedIndex.get(key);
      if (currentIdx !== targetIdx) {
        orderedKeys.splice(currentIdx, 1);
        orderedKeys.splice(targetIdx, 0, key);
        // Update keyToOrderedIndex only for the range that shifted.
        const lo = currentIdx < targetIdx ? currentIdx : targetIdx;
        const hi = currentIdx < targetIdx ? targetIdx : currentIdx;
        for (let i = lo; i <= hi; i++) {
          keyToOrderedIndex.set(orderedKeys[i], i);
        }
      }
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
        const idx = keyToOrderedIndex.get(key);
        if (idx !== undefined) {
          orderedKeys.splice(idx, 1);
          keyToOrderedIndex.delete(key);
          for (let i = idx; i < orderedKeys.length; i++) {
            keyToOrderedIndex.set(orderedKeys[i], i);
          }
        }
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
    useItemCount,
    useItemValues,
    getTrackedItemByIndex,
    countSignal,
    totalCountSignal,
  };
};
