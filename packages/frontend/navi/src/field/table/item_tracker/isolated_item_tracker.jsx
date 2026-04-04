// https://github.com/reach/reach-ui/tree/b3d94d22811db6b5c0f272b9a7e2e3c1bb4699ae/packages/descendants
// https://github.com/pacocoursey/use-descendants/tree/master

/*
 * Item Tracker Isolated System - A Preact hook for tracking dynamic lists without infinite re-renders
 *
 * USE CASE:
 * This is specifically designed for scenarios where item registration and usage are SEPARATE,
 * such as HTML tables with colgroup elements where colgroup registers columns and tbody uses them.
 *
 * For simpler cases where item definition and usage are colocated (same component tree),
 * prefer useItemTracker instead.
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
 * RENDER ORDER REQUIREMENT:
 * Producer MUST render before Consumer in the React tree for proper synchronization.
 */

import { createContext } from "preact";
import { useContext, useMemo, useRef } from "preact/hooks";

import { compareTwoJsValues } from "../../../utils/compare_two_js_values.js";

export const createIsolatedItemTracker = () => {
  // Producer contexts (ref-based, no re-renders)
  const ProducerTrackerContext = createContext();
  const ProducerItemCountRefContext = createContext();
  const ProducerListRenderIdContext = createContext();

  // Consumer contexts (state-based, re-renders)
  const ConsumerItemsContext = createContext();

  const useIsolatedItemTrackerProvider = () => {
    const itemsRef = useRef([]);
    const items = itemsRef.current;
    const itemCountRef = useRef();

    const itemTracker = useMemo(() => {
      // Snapshot taken by FlushSentinel after all producer children rendered.
      // Consumers read from this — always up-to-date within the same render pass.
      const itemsSnapshotRef = { current: items };

      const registerItem = (index, value) => {
        const hasValue = index in items;
        if (hasValue) {
          const currentValue = items[index];
          if (compareTwoJsValues(currentValue, value)) {
            return;
          }
        }

        items[index] = value;
      };

      const getProducerItem = (itemIndex) => {
        return items[itemIndex];
      };

      const ItemProducerProvider = ({ children }) => {
        items.length = 0;
        itemCountRef.current = 0;
        const listRenderId = {};

        return (
          <ProducerItemCountRefContext.Provider value={itemCountRef}>
            <ProducerListRenderIdContext.Provider value={listRenderId}>
              <ProducerTrackerContext.Provider value={itemTracker}>
                {children}
                <FlushSentinel />
              </ProducerTrackerContext.Provider>
            </ProducerListRenderIdContext.Provider>
          </ProducerItemCountRefContext.Provider>
        );
      };

      // Renders after all producer children (e.g. <Col>) have registered their
      // items. Taking a snapshot here guarantees the consumer sees the correct
      // item list within the same render pass, without any heuristic.
      const FlushSentinel = () => {
        itemsSnapshotRef.current = items;
        return null;
      };

      const ItemConsumerProvider = ({ children }) => {
        // FlushSentinel (last child of ItemProducerProvider) already set
        // itemsSnapshotRef.current to the up-to-date items array before any
        // consumer rendered. Reading from the snapshot is always correct.
        return (
          <ConsumerItemsContext.Provider value={itemsSnapshotRef.current}>
            {children}
          </ConsumerItemsContext.Provider>
        );
      };

      return {
        registerItem,
        getProducerItem,
        ItemProducerProvider,
        ItemConsumerProvider,
      };
    }, []);

    const { ItemProducerProvider, ItemConsumerProvider } = itemTracker;

    return [ItemProducerProvider, ItemConsumerProvider, items];
  };

  // Hook for producers to register items (ref-based, no re-renders)
  const useTrackIsolatedItem = (data) => {
    const listRenderId = useContext(ProducerListRenderIdContext);
    const itemCountRef = useContext(ProducerItemCountRefContext);
    const itemTracker = useContext(ProducerTrackerContext);
    const listRenderIdRef = useRef();
    const itemIndexRef = useRef();
    const dataRef = useRef();
    const prevListRenderId = listRenderIdRef.current;

    if (prevListRenderId === listRenderId) {
      const itemIndex = itemIndexRef.current;
      itemTracker.registerItem(itemIndex, data);
      dataRef.current = data;
      return itemIndex;
    }

    listRenderIdRef.current = listRenderId;
    const itemCount = itemCountRef.current;
    const itemIndex = itemCount;
    itemCountRef.current = itemIndex + 1;
    itemIndexRef.current = itemIndex;
    dataRef.current = data;
    itemTracker.registerItem(itemIndex, data);
    return itemIndex;
  };

  const useTrackedIsolatedItem = (itemIndex) => {
    const items = useTrackedIsolatedItems();
    const item = items[itemIndex];
    return item;
  };

  // Hooks for consumers to read items (state-based, re-renders)
  const useTrackedIsolatedItems = () => {
    const consumerItems = useContext(ConsumerItemsContext);
    if (!consumerItems) {
      throw new Error(
        "useTrackedIsolatedItems must be used within <ItemConsumerProvider />",
      );
    }
    return consumerItems;
  };

  return [
    useIsolatedItemTrackerProvider,
    useTrackIsolatedItem,
    useTrackedIsolatedItem,
    useTrackedIsolatedItems,
  ];
};
