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
 *   - registrations: Map order → data, contains only visible items
 *   - idToOrder: Map id → order, stable across renders
 *   - sortedOrders: number[] of visible item orders, kept sorted via bisect insert/remove
 *   - countSignal: signal(number), updated in microtask batch, only when count changes
 *   - propSignals: Map propName → signal(array), updated in microtask batch with element equality
 *   - onChangeRef: holds the latest onChange callback, called once per microtask batch
 *
 *   useTrackItem: updates registrations + sortedOrders synchronously during the
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

      onChange?.(sortedOrders.map((order) => registrations.get(order)));
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

  const getTrackedItemByIndex = (index) => {
    const order = sortedOrders[index];
    if (order === undefined) {
      return undefined;
    }
    return registrations.get(order);
  };

  return {
    useTrackItem,
    useItemCount,
    useItemValues,
    getTrackedItemByIndex,
    countSignal,
  };
};
