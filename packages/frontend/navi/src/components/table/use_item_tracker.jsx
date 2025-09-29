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

export const useItemTracker = () => {
  const itemsRef = useRef([]);
  const itemCountRef = useRef();
  const pendingFlushRef = useRef(false);

  const itemTracker = useMemo(() => {
    // Producer methods (ref-based)
    const registerItem = (index, value) => {
      itemsRef.current[index] = value;
      pendingFlushRef.current = true;
    };

    const getProducerItem = (itemIndex) => {
      return itemsRef.current[itemIndex];
    };

    // Producer provider - uses refs, never causes re-renders in parent
    const ItemProducerProvider = ({ children }) => {
      // Reset for new render cycle
      itemsRef.current.length = 0;
      itemCountRef.current = 0;
      pendingFlushRef.current = false;
      const listRenderId = {};

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
      const [consumerItems, setConsumerItems] = useState([]);

      // Flush to consumer state after render
      useLayoutEffect(() => {
        if (!pendingFlushRef.current) {
          return;
        }
        const items = itemsRef.current;
        pendingFlushRef.current = false;
        setConsumerItems([...items]);
      });

      return (
        <ConsumerItemsContext.Provider value={consumerItems}>
          {children}
        </ConsumerItemsContext.Provider>
      );
    };

    return {
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

  if (prevListRenderId === listRenderId) {
    const itemIndex = itemIndexRef.current;
    if (compareTwoJsValues(dataRef.current, data)) {
      return itemIndex;
    }
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
