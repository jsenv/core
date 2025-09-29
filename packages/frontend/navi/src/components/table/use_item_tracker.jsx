// https://github.com/reach/reach-ui/tree/b3d94d22811db6b5c0f272b9a7e2e3c1bb4699ae/packages/descendants
// https://github.com/pacocoursey/use-descendants/tree/master

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
const ConsumerFlushContext = createContext();

export const useItemTracker = () => {
  const itemsRef = useRef([]);
  const items = itemsRef.current;
  const itemCountRef = useRef();
  const pendingFlushRef = useRef(false);
  const producerIsRenderingRef = useRef(false);

  const itemTracker = useMemo(() => {
    // Producer methods (ref-based)
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
        // no need to update state as producer is rendering
        // which means consumer will also re-render
        // (this is part of why consumer MUST be after producer in the render tree)
        return;
      }
      pendingFlushRef.current = true;
    };

    const getProducerItem = (itemIndex) => {
      return items[itemIndex];
    };

    // Producer provider - uses refs, never causes re-renders in parent
    const ItemProducerProvider = ({ children }) => {
      // Reset for new render cycle
      items.length = 0;
      itemCountRef.current = 0;
      pendingFlushRef.current = false;
      producerIsRenderingRef.current = true;
      const listRenderId = {};

      useLayoutEffect(() => {
        producerIsRenderingRef.current = false;
      });

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
      // Move the state here so it only affects this subtree
      const [consumerItems, setConsumerItems] = useState(itemsRef.current);

      const flushToConsumers = () => {
        if (!pendingFlushRef.current) {
          return;
        }
        const itemsCopy = [...items];
        pendingFlushRef.current = false;
        setConsumerItems(itemsCopy);
      };

      // Flush to consumer state after render
      useLayoutEffect(() => {
        flushToConsumers();
      });

      return (
        <ConsumerFlushContext.Provider value={flushToConsumers}>
          <ConsumerItemsContext.Provider value={consumerItems}>
            {children}
          </ConsumerItemsContext.Provider>
        </ConsumerFlushContext.Provider>
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
  const flushToConsumers = useContext(ConsumerFlushContext);

  useLayoutEffect(() => {
    if (itemTracker.pendingFlushRef.current) {
      flushToConsumers();
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

// Hooks for consumers to read items (state-based, re-renders)
export const useTrackedItems = () => {
  const consumerItems = useContext(ConsumerItemsContext);
  return consumerItems;
};

export const useTrackedItem = (itemIndex) => {
  const items = useTrackedItems();
  return items[itemIndex];
};
