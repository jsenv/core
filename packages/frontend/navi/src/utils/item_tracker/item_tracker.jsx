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
  // orderedKeys: visible item keys in natural (JSX declaration) order.
  // Each entry is { insertionKey } so we can find and splice by key.
  const orderedKeys = []; // number[]
  const allKeys = new Set(); // all registered keys including hidden
  // Tracks the JSX render order of visible items across the current render pass
  // (both the synchronous render-time syncItem and the layout-effect syncItem run
  // top-to-bottom in JSX order). notify() uses this to sort orderedKeys so that
  // items reordered by the caller (e.g. useSearch re-sorts) are reflected in the
  // tracker order, which drives scroll targets and separator positioning.
  const renderPhaseKeys = [];

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

      // Sort orderedKeys to match the JSX render order captured during this pass.
      if (renderPhaseKeys.length > 0) {
        const phaseMap = new Map(renderPhaseKeys.map((k, i) => [k, i]));
        orderedKeys.sort(
          (a, b) =>
            (phaseMap.get(a) ?? Infinity) - (phaseMap.get(b) ?? Infinity),
        );
        renderPhaseKeys.length = 0;
      }
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
      const idx = orderedKeys.indexOf(key);
      if (idx !== -1) {
        orderedKeys.splice(idx, 1);
      }
      if (data.role !== "presentation") {
        allKeys.add(key);
      } else {
        allKeys.delete(key);
      }
    } else {
      if (!orderedKeys.includes(key)) {
        orderedKeys.push(key);
      }
      registrations.set(key, data);
      allKeys.add(key);
      // Record render order (first occurrence per pass wins, since both render-time
      // and layout-effect calls run top-to-bottom in JSX order).
      if (!renderPhaseKeys.includes(key)) {
        renderPhaseKeys.push(key);
      }
      // Sort orderedKeys immediately so that indexOf() returns the correct
      // position during this render — not a stale position from the previous
      // render. Items not yet seen in this pass stay at the end in their
      // previous relative order.
      orderedKeys.sort((a, b) => {
        const ai = renderPhaseKeys.indexOf(a);
        const bi = renderPhaseKeys.indexOf(b);
        const aIdx = ai === -1 ? Infinity : ai;
        const bIdx = bi === -1 ? Infinity : bi;
        return aIdx - bIdx;
      });
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
        const idx = orderedKeys.indexOf(key);
        if (idx !== -1) {
          orderedKeys.splice(idx, 1);
        }
        allKeys.delete(key);
        notify();
      };
    }, []);

    if (data.hidden || data.role === "presentation") {
      return -1;
    }
    return orderedKeys.indexOf(key);
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
