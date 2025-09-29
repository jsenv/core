// https://github.com/reach/reach-ui/tree/b3d94d22811db6b5c0f272b9a7e2e3c1bb4699ae/packages/descendants
// https://github.com/pacocoursey/use-descendants/tree/master

/*
 * Item Tracker System - A Preact hook for tracking dynamic lists without infinite re-renders
 *
 * USE CASE:
 * This is specifically designed for scenarios where item registration and usage are SEPARATE,
 * such as HTML tables with <colgroup> elements:
 * - Table cells register their column data during render
 * - <colgroup> needs access to all columns to generate proper <col> elements
 * - Registration happens in table body, usage happens in table header
 *
 * For simpler cases where item definition and usage are colocated (same component tree),
 * prefer more straightforward approaches like useState or useRef directly.
 *
 * PROBLEM SOLVED:
 * When building dynamic lists with separated registration/usage, we often need to:
 * 1. Collect data from child components during render (registration)
 * 2. Track changes to individual items
 * 3. Provide access to the full list to other components (usage)
 *
 * Naive approaches cause infinite re-render loops because:
 * - setState during render causes the parent to re-render
 * - Which triggers children to re-render and call setState again
 *
 * SOLUTION ARCHITECTURE:
 * This system uses a Producer/Consumer pattern with separate context trees:
 *
 * 1. PRODUCER SIDE (ref-based, no re-renders):
 *    - ItemProducerProvider: Manages item registration without causing re-renders
 *    - useTrackItem: Registers individual items using refs
 *    - Items are stored in a mutable array via useRef
 *
 * 2. CONSUMER SIDE (state-based, re-renders when needed):
 *    - ItemConsumerProvider: Manages reactive state for consumers
 *    - useTrackedItems/useTrackedItem: Read the tracked items with reactivity
 *    - State is synchronized from producer side at controlled intervals
 *
 * USAGE:
 * ```jsx
 * const [ItemProducerProvider, ItemConsumerProvider] = useItemTracker();
 *
 * return (
 *   <table>
 *     <ItemProducerProvider>
 *       <colgroup>
 *         <ColumnElements /> // Registers columns
 *       </colgroup>
 *     </ItemProducerProvider>
 *     <ItemConsumerProvider>
 *       <tbody>
 *         {rows.map(row => <TableRow row={row} />)} // Uses tracked columns
 *       </tbody>
 *     </ItemConsumerProvider>
 *   </table>
 * );
 *
 * function ColumnElement({ column }) {
 *   const index = useTrackItem(column); // Registers column, returns index
 *   return <col width={column.width} />;
 * }
 *
 * function TableCell({ columnIndex }) {
 *   const column = useTrackedItem(columnIndex); // Gets tracked column reactively
 *   return <td style={{ width: column.width }}>{column.content}</td>;
 * }
 * ```
 *
 * RENDER ORDER REQUIREMENT:
 * Producer MUST render before Consumer in the React tree for proper synchronization.
 */

import { createContext } from "preact";
import {
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";

import { compareTwoJsValues } from "../../utils/compare_two_js_values.js";

// Producer contexts (ref-based, no re-renders)
const ProducerTrackerContext = createContext();
const ProducerItemCountRefContext = createContext();
const ProducerListRenderIdContext = createContext();

// Consumer contexts (state-based, re-renders)
const ConsumerItemsContext = createContext();

export const useItemTracker = () => {
  const itemsRef = useRef([]);
  const items = itemsRef.current;
  const itemCountRef = useRef();
  const pendingFlushRef = useRef(false);
  const producerIsRenderingRef = useRef(false);

  const itemTracker = useMemo(() => {
    const registerItem = (index, value) => {
      const hasValue = index in items;
      if (hasValue) {
        const currentValue = items[index];
        if (compareTwoJsValues(currentValue, value)) {
          return;
        }
      }

      items[index] = value;

      if (producerIsRenderingRef.current) {
        // Consumer will sync after producer render completes
        return;
      }

      pendingFlushRef.current = true;
    };

    const getProducerItem = (itemIndex) => {
      return items[itemIndex];
    };

    // Producer provider - uses refs, never causes re-renders in parent
    const ItemProducerProvider = ({ children }) => {
      items.length = 0;
      itemCountRef.current = 0;
      pendingFlushRef.current = false;
      producerIsRenderingRef.current = true;
      const listRenderId = {};

      useLayoutEffect(() => {
        producerIsRenderingRef.current = false;
      });

      // CRITICAL: Sync consumer state on subsequent renders
      // This handles cases where the app re-renders (e.g., parent state change)
      // and we need to notify consumers that the producer has rebuilt its items.
      // Without this, consumers would show stale data until something forces then to refresh.
      const renderedOnce = useRef(false);
      useLayoutEffect(() => {
        if (!renderedOnce.current) {
          renderedOnce.current = true;
          return;
        }
        pendingFlushRef.current = true;
        itemTracker.flushToConsumers();
      }, [listRenderId]);

      return (
        <ProducerItemCountRefContext.Provider value={itemCountRef}>
          <ProducerListRenderIdContext.Provider value={listRenderId}>
            <ProducerTrackerContext.Provider value={itemTracker}>
              {children}
            </ProducerTrackerContext.Provider>
          </ProducerListRenderIdContext.Provider>
        </ProducerItemCountRefContext.Provider>
      );
    };

    // Consumer provider - uses state, causes re-renders only for this subtree
    const ItemConsumerProvider = ({ children }) => {
      const [consumerItems, setConsumerItems] = useState(itemsRef.current);

      const flushToConsumers = () => {
        if (!pendingFlushRef.current) {
          return;
        }
        const itemsCopy = [...items];
        pendingFlushRef.current = false;
        setConsumerItems(itemsCopy);
      };
      itemTracker.flushToConsumers = flushToConsumers;

      useLayoutEffect(() => {
        flushToConsumers();
      });

      return (
        <ConsumerItemsContext.Provider value={consumerItems}>
          {children}
        </ConsumerItemsContext.Provider>
      );
    };

    return {
      pendingFlushRef,
      itemsRef,
      registerItem,
      getProducerItem,
      ItemProducerProvider,
      ItemConsumerProvider,
    };
  }, []); // No dependencies to avoid recreation

  const { ItemProducerProvider, ItemConsumerProvider } = itemTracker;

  return [ItemProducerProvider, ItemConsumerProvider];
};

// Hook for producers to register items (ref-based, no re-renders)
export const useTrackItem = (data) => {
  const listRenderId = useContext(ProducerListRenderIdContext);
  const itemCountRef = useContext(ProducerItemCountRefContext);
  const itemTracker = useContext(ProducerTrackerContext);
  const listRenderIdRef = useRef();
  const itemIndexRef = useRef();
  const dataRef = useRef();
  const prevListRenderId = listRenderIdRef.current;

  // CRITICAL: Handle individual item updates outside full render cycles
  // This is essential for cases where only a single producer item re-renders
  // (e.g., local state change in a column component) without the parent
  // ItemProducerProvider re-rendering. Without this, consumer state would
  // become stale until the next full app re-render.
  useLayoutEffect(() => {
    if (itemTracker.pendingFlushRef.current) {
      itemTracker.flushToConsumers();
    }
  });

  if (prevListRenderId === listRenderId) {
    const itemIndex = itemIndexRef.current;
    itemTracker.registerItem(itemIndex, data);
    dataRef.current = data;
    return itemIndex;
  }
  // New render cycle: assign new index and register
  listRenderIdRef.current = listRenderId;
  const itemCount = itemCountRef.current;
  const itemIndex = itemCount;
  itemCountRef.current = itemIndex + 1;
  itemIndexRef.current = itemIndex;
  dataRef.current = data;
  itemTracker.registerItem(itemIndex, data);
  return itemIndex;
};

// Hooks for consumers to read items (state-based, re-renders)
export const useTrackedItems = () => {
  const consumerItems = useContext(ConsumerItemsContext);
  return consumerItems;
};

export const useTrackedItem = (itemIndex) => {
  const items = useTrackedItems();
  return items[itemIndex];
};
