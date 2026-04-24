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

export const createItemTracker = ({ filter: filterFn } = {}) => {
  const ItemTrackerContext = createContext();

  const useItemTrackerProvider = () => {
    const renderItemsRef = useRef([]);
    const renderItems = renderItemsRef.current;
    const renderCountRef = useRef(0);

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
      // committedItems is a live array: always up-to-date by the time any
      // sibling or ancestor layoutEffect reads it (bottom-up effect ordering).
      ItemTrackerProvider.items = committedItems;

      return {
        ItemTrackerProvider,
        items: committedItems,
        registerItem: (data) => {
          if (filterFn && !filterFn(data)) {
            return -1;
          }
          const index = renderCountRef.current++;
          renderItems[index] = data;
          return index;
        },
        commitItem: (stableId, index, data) => {
          if (index === -1) {
            return;
          }
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
    // registerItem returns -1 when a filterFn is set and the item doesn't pass.
    // Otherwise returns the sequential index among passing items.
    // Note: registerItem is always called to keep hook call count stable.
    const renderOrderIndex = tracker.registerItem(data);
    // explicitIndex is used for stable committed ordering (e.g. keyboard nav),
    // but the VS window check must use renderOrderIndex (rank among visible items).
    const committedIndex =
      explicitIndex !== undefined && renderOrderIndex !== -1
        ? explicitIndex
        : renderOrderIndex;
    useLayoutEffect(() => {
      if (renderOrderIndex === -1) {
        tracker.decommitItem(id);
      } else {
        tracker.commitItem(id, committedIndex, data);
      }
      return () => {
        tracker.decommitItem(id);
      };
    });
    return renderOrderIndex;
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
  const entries = Array.from(committedMap.values());
  entries.sort((a, b) => a.index - b.index);
  committedItems.length = entries.length;
  for (let i = 0; i < entries.length; i++) {
    committedItems[i] = entries[i].data;
  }
};
