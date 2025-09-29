// https://github.com/reach/reach-ui/tree/b3d94d22811db6b5c0f272b9a7e2e3c1bb4699ae/packages/descendants
// https://github.com/pacocoursey/use-descendants/tree/master

/*
 * Item Tracker System - A Preact hook for tracking dynamic lists without infinite re-renders
 *
 * USE CASE:
 * This is specifically designed for scenarios where item registration and usage are SEPARATE,
 * such as HTML tables with <colgroup> elements:
 * - <colgroup> contains <col> elements that need to register their column data
 * - Table cells in <tbody> need to read column data to render correctly
 * - <colgroup> renders first (producer), <tbody> renders later (consumer)
 * - Column data flows from colgroup → table cells, not the other way around
 *
 * Real-world example: Dynamic table where column widths are defined in <colgroup>
 * but table cells need those widths for proper rendering and layout calculations.
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

      // CRITICAL DECISION POINT: How should consumers be notified?
      if (producerIsRenderingRef.current) {
        // SCENARIO 1: We're in a full render cycle (app state changed)
        // The consumer will automatically sync after producer finishes
        // because ItemProducerProvider's useLayoutEffect (line ~147) will
        // trigger flushToConsumers() for all newly registered items.
        return;
      }

      // SCENARIO 2: Individual item update outside render cycle
      // (e.g., user interaction changed a single column's local state)
      // We must manually mark for flush so useTrackItem's useLayoutEffect
      // (line ~218) can immediately sync this change to consumers.
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
          // Early return: No changes waiting to be flushed
          // This prevents unnecessary re-renders when called during
          // full render cycles where state is already synchronized
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
  // This connects to registerItem's pendingFlushRef.current = true (line ~125)
  // When a single producer item changes (local state), registerItem marks
  // pendingFlushRef = true, and this effect immediately flushes to consumers.
  // Without this, individual changes would wait until the next full app render.
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
