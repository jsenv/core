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
 *           {rows.map(({ id, name, color }) => (
 *             <TableRow key={id} name={name} color={color}>
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
 * function TableRow({ name, color, children }) {
 *   const rowIndex = useRegisterRow({ name, color });
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

export const createItemTracker = () => {
  const ItemTrackerContext = createContext();

  const useItemTrackerProvider = () => {
    const renderItemsRef = useRef([]);
    const renderItems = renderItemsRef.current;
    const renderCountRef = useRef(0);

    // committedItems is the stable snapshot exposed via ItemTrackerProvider.items.
    // It is maintained by per-item useLayoutEffect hooks (commitItem/decommitItem),
    // so it stays correct even when Preact bails out on children:
    //   - bailout → no item effects fire → committedItems unchanged (correct)
    //   - genuine unmount → decommitItem cleanup fires → committedItems updated (correct)
    const committedItemsRef = useRef([]);
    const committedItems = committedItemsRef.current;
    const committedMapRef = useRef(new Map()); // stableId → { index, data }

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
        },
      };
    }, []);

    return tracker.ItemTrackerProvider;
  };

  const useTrackItem = (data) => {
    const tracker = useContext(ItemTrackerContext);
    if (!tracker) {
      throw new Error(
        "useTrackItem must be used within SimpleItemTrackerProvider",
      );
    }
    // Stable identity per component instance — survives re-renders.
    const stableIdRef = useRef(null);
    if (stableIdRef.current === null) {
      stableIdRef.current = Symbol();
    }
    const index = tracker.registerItem(data);
    // Commit this item into the stable snapshot after every render.
    // Running without deps ensures the committed index and data are always
    // up to date when items re-render (e.g. index shifts after add/remove).
    // When Preact bails out on this item, this effect does not fire at all,
    // which is exactly what we want: committedItems stays unchanged.
    useLayoutEffect(() => {
      tracker.commitItem(stableIdRef.current, index, data);
      return () => {
        tracker.decommitItem(stableIdRef.current);
      };
    });
    return index;
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
  const entries = [...committedMap.values()].sort((a, b) => a.index - b.index);
  committedItems.length = 0;
  for (const { data } of entries) {
    committedItems.push(data);
  }
};
