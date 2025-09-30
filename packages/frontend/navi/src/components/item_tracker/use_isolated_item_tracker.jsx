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
import {
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";

import { compareTwoJsValues } from "../../utils/compare_two_js_values.js";

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

      const ItemConsumerProvider = ({ children }) => {
        const [consumerItems, setConsumerItems] = useState(items);

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
    return consumerItems;
  };

  return [
    useIsolatedItemTrackerProvider,
    useTrackIsolatedItem,
    useTrackedIsolatedItem,
    useTrackedIsolatedItems,
  ];
};
