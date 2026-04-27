import { signal } from "@preact/signals";
import { useLayoutEffect, useRef } from "preact/hooks";

/*
 * Item Tracker — tracks a set of visible items and exposes reactive signals.
 *
 * USAGE:
 * ```jsx
 * const tracker = createItemTracker();
 *
 * function Row({ id, hidden, value }) {
 *   const index = tracker.useTrackItem(id, { hidden, value });
 *   if (index === -1) return null;
 *   return <li>{value}</li>;
 * }
 *
 * function Count() {
 *   const count = tracker.useTrackerItemCount(); // re-renders only when count changes
 *   return <span>{count} items</span>;
 * }
 *
 * function Values() {
 *   const values = tracker.useTrackerItemProp("value"); // re-renders only when values change
 *   return <span>{values.join(", ")}</span>;
 * }
 * ```
 *
 * INTERNALS:
 *   - registrations: Map order → data, contains only visible items
 *   - idToOrder: Map id → order, stable across renders
 *   - sortedOrders: number[] of visible item orders, kept sorted via bisect insert/remove
 *   - countSignal: signal(number), updated in microtask batch, only when count changes
 *   - propSignals: Map propName → signal(array), updated in microtask batch with element equality
 *
 *   useTrackItem: updates registrations + sortedOrders synchronously during the
 *   layout-effect phase so index (= bisect position) is correct for the same commit.
 *   Signals are deferred to a microtask so multiple items updating in one batch
 *   cause only one signal update.
 */

export const useItemTracker = () => {
  const trackerRef = useRef(null);
  let tracker = trackerRef.current;
  if (!tracker) {
    tracker = createItemTracker();
    trackerRef.current = tracker;
  }
  return tracker;
};

const createItemTracker = () => {
  const registrations = new Map(); // order → data (visible items only)
  const idToOrder = new Map(); // id → order
  let orderCounter = 0;
  const sortedOrders = []; // visible item orders, kept sorted

  const bisect = (order) => {
    let lo = 0;
    let hi = sortedOrders.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sortedOrders[mid] < order) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    return lo;
  };

  const insertOrder = (order) => {
    sortedOrders.splice(bisect(order), 0, order);
  };

  const removeOrder = (order) => {
    const pos = bisect(order);
    if (sortedOrders[pos] === order) {
      sortedOrders.splice(pos, 1);
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

      // sortedOrders is already sorted — no sort needed
      const newCount = sortedOrders.length;
      if (countSignal.peek() !== newCount) {
        countSignal.value = newCount;
      }

      for (const [propName, sig] of propSignals) {
        const prev = sig.peek();
        const next = sortedOrders.map(
          (order) => registrations.get(order)[propName],
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
    });
  };

  // Subscribes the calling component to the count signal.
  // Only re-renders when the visible item count changes.
  const useTrackerItemCount = () => countSignal.value;

  // Subscribes the calling component to a per-prop signal.
  // Only re-renders when the array of values for that prop changes.
  const useTrackerItemProp = (propName) => getPropSignal(propName).value;

  // Register an item. data.hidden controls visibility.
  // Returns the item's index among visible items, or -1 when hidden.
  // sortedOrders is updated synchronously so the index is accurate for this
  // commit; signals are deferred to a microtask batch.
  const useTrackItem = (id, data) => {
    if (!idToOrder.has(id)) {
      idToOrder.set(id, orderCounter++);
    }
    const order = idToOrder.get(id);

    // Sync update so index is correct during this render
    if (data.hidden) {
      registrations.delete(order);
      removeOrder(order);
    } else {
      registrations.set(order, data);
      if (sortedOrders[bisect(order)] !== order) {
        insertOrder(order);
      }
    }

    useLayoutEffect(() => {
      if (data.hidden) {
        registrations.delete(order);
        removeOrder(order);
      } else {
        registrations.set(order, data);
        if (sortedOrders[bisect(order)] !== order) {
          insertOrder(order);
        }
      }
      notify();
    });

    useLayoutEffect(() => {
      return () => {
        registrations.delete(order);
        removeOrder(order);
        notify();
      };
    }, []);

    if (data.hidden) {
      return -1;
    }
    return bisect(order);
  };

  // Direct access for effects that need the count synchronously
  // (e.g. filler height calculations), without subscribing to the signal.
  const getVisibleCount = () => sortedOrders.length;

  // Returns current visible items as an array ordered by insertion order.
  const getItems = () => sortedOrders.map((order) => registrations.get(order));

  return {
    useTrackItem,
    useTrackerItemProp,
    useTrackerItemCount,
    countSignal,
    getVisibleCount,
    getItems,
  };
};
