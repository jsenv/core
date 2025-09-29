// https://github.com/reach/reach-ui/tree/b3d94d22811db6b5c0f272b9a7e2e3c1bb4699ae/packages/descendants
// https://github.com/pacocoursey/use-descendants/tree/master

/*
 * Item Tracker System - A Preact hook for tracking dynamic lists without infinite re-renders
 *
 * PROBLEM SOLVED:
 * When building dynamic lists (like tables), we often need to:
 * 1. Collect data from child components during render
 * 2. Track changes to individual items
 * 3. Provide access to the full list to other components
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
 *   <ItemProducerProvider>
 *     {items.map(item => <ProducerItem item={item} />)}
 *   </ItemProducerProvider>
 *   <ItemConsumerProvider>
 *     <ConsumerComponent />
 *   </ItemConsumerProvider>
 * );
 *
 * function ProducerItem({ item }) {
 *   const index = useTrackItem(item); // Registers item, returns index
 *   return <div>Item {index}: {item.name}</div>;
 * }
 *
 * function ConsumerComponent() {
 *   const items = useTrackedItems(); // Gets all tracked items reactively
 *   return <div>Total: {items.length}</div>;
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
// These contexts use refs and mutable data to avoid triggering re-renders
const ProducerTrackerContext = createContext(); // Main tracker object with registerItem, etc.
const ProducerItemCountRefContext = createContext(); // Current item count for index assignment
const ProducerListRenderIdContext = createContext(); // Render cycle detection (new object per render)

// Consumer contexts (state-based, re-renders)
// These contexts use state to provide reactivity to consumer components
const ConsumerItemsContext = createContext(); // Array of tracked items (reactive state)

export const useItemTracker = () => {
  // Core storage: mutable array that doesn't trigger re-renders when modified
  const itemsRef = useRef([]);
  const items = itemsRef.current;

  // Tracking refs for render cycle management
  const itemCountRef = useRef(); // Assigns sequential indices to items
  const pendingFlushRef = useRef(false); // Tracks if consumer state needs updating
  const producerIsRenderingRef = useRef(false); // Prevents state updates during render

  const itemTracker = useMemo(() => {
    // Producer methods (ref-based)
    const registerItem = (index, value) => {
      // Skip update if value hasn't changed (optimization)
      const hasValue = index in items;
      if (hasValue) {
        const currentValue = items[index];
        if (compareTwoJsValues(currentValue, value)) {
          return;
        }
      }

      // Update the mutable items array (doesn't cause re-renders)
      items[index] = value;

      if (producerIsRenderingRef.current) {
        // During render cycle: don't flush immediately
        // Consumer will sync after producer render completes
        // (this is why consumer MUST render after producer in the tree)
        return;
      }

      // Outside render cycle: mark for immediate flush to consumers
      pendingFlushRef.current = true;
    };

    const getProducerItem = (itemIndex) => {
      return items[itemIndex];
    };

    // Producer provider - uses refs, never causes re-renders in parent
    const ItemProducerProvider = ({ children }) => {
      // Reset state for new render cycle
      items.length = 0; // Clear previous items
      itemCountRef.current = 0; // Reset item counter
      pendingFlushRef.current = false; // Clear pending state
      producerIsRenderingRef.current = true; // Mark as rendering
      const listRenderId = {}; // New object = new render cycle

      // Mark rendering as complete after layout
      useLayoutEffect(() => {
        producerIsRenderingRef.current = false;
      });

      // CRITICAL: Sync consumer state on subsequent renders
      // This handles the case where app re-renders (e.g., state change)
      // and we need to update consumer state with newly registered items
      const renderedOnce = useRef(false);
      useLayoutEffect(() => {
        if (!renderedOnce.current) {
          renderedOnce.current = true;
          return; // Skip first render (initial state is correct)
        }
        // Force consumer sync after producer rebuilds items array
        pendingFlushRef.current = true;
        itemTracker.flushToConsumers();
      }, [listRenderId]); // listRenderId changes every render

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
      // Initialize with current items state (after producer reset/rebuild)
      // This captures the items array after ItemProducerProvider has reset it
      const [consumerItems, setConsumerItems] = useState(itemsRef.current);

      // Flush pending changes from producer to consumer state
      // Only updates when pendingFlushRef indicates changes are waiting
      const flushToConsumers = () => {
        if (!pendingFlushRef.current) {
          return; // No pending changes
        }
        const itemsCopy = [...items]; // Create immutable copy for React state
        pendingFlushRef.current = false; // Clear pending flag
        setConsumerItems(itemsCopy); // Trigger re-render of consumer subtree
      };
      itemTracker.flushToConsumers = flushToConsumers;

      // Flush to consumer state after render
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
  // Get producer context values
  const listRenderId = useContext(ProducerListRenderIdContext); // Changes every render
  const itemCountRef = useContext(ProducerItemCountRefContext); // Item counter
  const itemTracker = useContext(ProducerTrackerContext); // Registration methods

  // Per-component refs for tracking state
  const listRenderIdRef = useRef(); // Previous render ID
  const itemIndexRef = useRef(); // This item's assigned index
  const dataRef = useRef(); // Previous data value
  const prevListRenderId = listRenderIdRef.current;

  // Flush any pending changes from individual item updates
  useLayoutEffect(() => {
    if (itemTracker.pendingFlushRef.current) {
      itemTracker.flushToConsumers();
    }
  });

  // Same render cycle: update existing item
  if (prevListRenderId === listRenderId) {
    const itemIndex = itemIndexRef.current;
    itemTracker.registerItem(itemIndex, data);
    dataRef.current = data;
    return itemIndex;
  }
  // New render cycle: assign new index and register
  listRenderIdRef.current = listRenderId; // Update render ID
  const itemCount = itemCountRef.current; // Get next available index
  const itemIndex = itemCount; // Assign sequential index
  itemCountRef.current = itemIndex + 1; // Increment counter for next item
  itemIndexRef.current = itemIndex; // Store this item's index
  dataRef.current = data; // Store data for comparison
  itemTracker.registerItem(itemIndex, data); // Register with tracker
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
