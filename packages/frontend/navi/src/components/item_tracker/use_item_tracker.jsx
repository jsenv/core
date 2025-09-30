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
 * const ItemTrackerProvider = useItemTracker();
 *
 * return (
 *   <ItemTrackerProvider>
 *     <table>
 *       <tbody>
 *         {rows.map(rowData => (
 *           <TableRow key={rowData.id} rowData={rowData}>
 *             {({ rowIndex }) => (
 *               <>
 *                 <TableCell rowIndex={rowIndex} column="name" />
 *                 <TableCell rowIndex={rowIndex} column="value" />
 *               </>
 *             )}
 *           </TableRow>
 *         ))}
 *       </tbody>
 *     </table>
 *   </ItemTrackerProvider>
 * );
 *
 * function TableRow({ rowData, children }) {
 *   const rowIndex = useRegisterItem(rowData);
 *   return <tr>{children({ rowIndex, rowData })}</tr>;
 * }
 *
 * function TableCell({ rowIndex, column }) {
 *   const rowData = useGetItem(rowIndex);
 *   return <td>{rowData[column]}</td>;
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
      return {
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

    const ItemTrackerProvider = ({ children }) => {
      // Reset on each render to start fresh
      tracker.reset();

      return (
        <ItemTrackerContext.Provider value={tracker}>
          {children}
        </ItemTrackerContext.Provider>
      );
    };
    return ItemTrackerProvider;
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
