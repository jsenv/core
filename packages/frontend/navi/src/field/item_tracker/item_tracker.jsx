import { createContext } from "preact";
import { useContext, useMemo, useRef } from "preact/hooks";

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
    const itemsRef = useRef([]);
    const items = itemsRef.current;
    const itemCountRef = useRef(0);

    const tracker = useMemo(() => {
      const ItemTrackerProvider = ({ children }) => {
        // Reset on each render to start fresh
        tracker.reset();

        return (
          <ItemTrackerContext.Provider value={tracker}>
            {children}
          </ItemTrackerContext.Provider>
        );
      };
      ItemTrackerProvider.items = items;

      return {
        ItemTrackerProvider,
        items,
        registerItem: (data) => {
          const index = itemCountRef.current++;
          items[index] = data;
          return index;
        },
        getItem: (index) => {
          return items[index];
        },
        getAllItems: () => {
          return items;
        },
        reset: () => {
          items.length = 0;
          itemCountRef.current = 0;
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
    return tracker.registerItem(data);
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
