import { createContext } from "preact";
import { useContext, useLayoutEffect, useMemo, useRef } from "preact/hooks";

/*
 * Item Tracker - For colocated producer/consumer scenarios
 *
 * USE CASE:
 * This is for scenarios where producers and consumers are in the same
 * component tree, such as:
 * - TableRow components registering themselves
 * - TableCell components accessing row data by index
 * - Both happen within the same table structure
 *
 * Unlike the isolated producer/consumer system, this doesn't need complex
 * synchronization because everything happens in the same render cycle.
 *
 * USAGE:
 * ```jsx
 * // Create domain-specific tracker hooks
 * const [useRowTrackerProvider, useRegisterRow, useRow, useRows] = createItemTracker();
 *
 * function App() {
 *   const RowTrackerProvider = useRowTrackerProvider();
 *
 *   return (
 *     <RowTrackerProvider>
 *       <table>
 *         <tbody>
 *           {rows.map(({ id, name, color }, index) => (
 *             <TableRow key={id} id={id} index={index} name={name} color={color}>
 *               <TableCell column="name" />
 *               <TableCell column="color" />
 *             </TableRow>
 *           ))}
 *         </tbody>
 *       </table>
 *       <TrackedRowsList />
 *     </RowTrackerProvider>
 *   );
 * }
 *
 * function TableRow({ id, name, color, children }) {
 *   const rowIndex = useRegisterRow(id, { name, color });
 *   return (
 *     <tr>
 *       <TableRowIndexContext.Provider value={rowIndex}>
 *         {children}
 *       </TableRowIndexContext.Provider>
 *     </tr>
 *   );
 * }
 *
 * function TableCell({ column }) {
 *   const rowIndex = useContext(TableRowIndexContext);
 *   const rowData = useRow(rowIndex);
 *   return <td>{rowData[column]}</td>;
 * }
 *
 * function TrackedRowsList() {
 *   const rows = useRows();
 *   return <div>Total rows: {rows.length}</div>;
 * }
 * ```
 */

export const createItemTracker = ({ trackVisibility = false } = {}) => {
  const ItemTrackerContext = createContext();

  const useItemTrackerProvider = () => {
    const renderItemsRef = useRef([]);
    const renderItems = renderItemsRef.current;
    const renderCountRef = useRef(0);

    const committedItemsRef = useRef([]);
    const committedItems = committedItemsRef.current;
    const committedMapRef = useRef(new Map()); // stableId → { index, data }

    // When trackVisibility is true, these refs count visible items per render.
    const visibleCountRef = trackVisibility ? useRef(0) : null;
    const visibleRegisteredRef = trackVisibility ? useRef(false) : null;

    const tracker = useMemo(() => {
      const ItemTrackerProvider = ({ children }) => {
        // Reset render items on each render to start fresh.
        // Items re-register themselves during their render via registerItem().
        tracker.reset();

        return (
          <ItemTrackerContext.Provider value={tracker}>
            {children}
          </ItemTrackerContext.Provider>
        );
      };
      ItemTrackerProvider.items = committedItems;
      if (trackVisibility) {
        // Expose visible count as getters so consumers read the current ref
        // value after children have rendered (refs are always up to date).
        Object.defineProperty(ItemTrackerProvider, "visibleCount", {
          get: () => visibleCountRef.current,
        });
        Object.defineProperty(ItemTrackerProvider, "visibleRegistered", {
          get: () => visibleRegisteredRef.current,
        });
      }

      return {
        ItemTrackerProvider,
        items: committedItems,
        registerItem: (data) => {
          const index = renderCountRef.current++;
          renderItems[index] = data;
          return index;
        },
        commitItem: (stableId, index, data) => {
          committedMapRef.current.set(stableId, { index, data });
          rebuildCommittedItems(committedItems, committedMapRef.current);
        },
        decommitItem: (stableId) => {
          committedMapRef.current.delete(stableId);
          rebuildCommittedItems(committedItems, committedMapRef.current);
        },
        getItem: (index) => {
          return committedItems[index];
        },
        getAllItems: () => {
          return committedItems;
        },
        reset: () => {
          renderItems.length = 0;
          renderCountRef.current = 0;
          if (trackVisibility) {
            visibleCountRef.current = 0;
            visibleRegisteredRef.current = false;
          }
        },
        registerVisibleIndex: trackVisibility
          ? (hidden) => {
              visibleRegisteredRef.current = true;
              if (hidden) {
                return -1;
              }
              const idx = visibleCountRef.current;
              visibleCountRef.current = idx + 1;
              return idx;
            }
          : null,
      };
    }, []);

    return tracker.ItemTrackerProvider;
  };

  // id: stable identity for this item across re-renders — the same concept as
  // Preact's `key` prop (which is stripped from props and inaccessible here).
  // Callers must provide a unique id; for suggestions this is the value.
  const useTrackItem = (id, data, explicitIndex) => {
    const tracker = useContext(ItemTrackerContext);
    if (!tracker) {
      throw new Error(
        "useTrackItem must be used within SimpleItemTrackerProvider",
      );
    }
    // If an explicit index is provided, use it directly (required when items
    // can be reordered, e.g. after filtering). Otherwise fall back to
    // render-order index via registerItem (fine for static lists).
    // Note: registerItem is always called to keep hook call count stable.
    const renderOrderIndex = tracker.registerItem(data);
    const index =
      explicitIndex !== undefined ? explicitIndex : renderOrderIndex;
    const visibleIndex = trackVisibility
      ? tracker.registerVisibleIndex(data.hidden)
      : undefined;
    // Commit this item into the stable snapshot after every render.
    // Running without deps ensures the committed index and data are always
    // up to date when items re-render (e.g. index shifts after add/remove).
    // When Preact bails out on this item, this effect does not fire at all,
    // which is exactly what we want: committedItems stays unchanged.
    useLayoutEffect(() => {
      tracker.commitItem(id, index, data);
      return () => {
        tracker.decommitItem(id);
      };
    });
    return trackVisibility ? [index, visibleIndex] : index;
  };

  const useTrackedItem = (index) => {
    const trackedItems = useTrackedItems();
    const item = trackedItems[index];
    return item;
  };

  const useTrackedItems = () => {
    const tracker = useContext(ItemTrackerContext);
    if (!tracker) {
      throw new Error(
        "useTrackedItems must be used within SimpleItemTrackerProvider",
      );
    }
    return tracker.items;
  };

  return [
    useItemTrackerProvider,
    useTrackItem,
    useTrackedItem,
    useTrackedItems,
  ];
};

const rebuildCommittedItems = (committedItems, committedMap) => {
  committedItems.length = 0;
  for (const { index, data } of committedMap.values()) {
    committedItems[index] = data;
  }
};
