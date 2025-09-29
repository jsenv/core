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

const ItemTrackerContext = createContext();
export const ItemTrackerProvider = ItemTrackerContext.Provider;

const TrackItemContext = createContext();
const ItemCountRefContext = createContext();
const ListRenderIdContext = createContext();
const FlushContext = createContext();

export const useItemTracker = () => {
  const itemsRef = useRef([]);
  const itemCountRef = useRef();
  const [trackedItems, setTrackedItems] = useState([]);
  const pendingFlushRef = useRef(false);

  const itemTracker = useMemo(() => {
    const getItem = (itemIndex) => {
      const items = itemsRef.current;
      const item = items[itemIndex];
      return item;
    };

    const setItem = (index, value) => {
      const items = itemsRef.current;
      items[index] = value;
      // Mark that we need to flush to state after render
      pendingFlushRef.current = true;
    };

    const flushToState = () => {
      if (pendingFlushRef.current) {
        const items = itemsRef.current;
        pendingFlushRef.current = false;
        setTrackedItems([...items]);
      }
    };

    const useTrackItemProvider = () => {
      itemsRef.current.length = 0;
      itemCountRef.current = 0;
      setTrackedItems([]);
      pendingFlushRef.current = false;
      const listRenderId = {};

      return useMemo(() => {
        const TrackItemProvider = ({ children }) => {
          // Flush after each render cycle
          useLayoutEffect(() => {
            flushToState();
          });

          return (
            <ItemCountRefContext.Provider value={itemCountRef}>
              <ListRenderIdContext.Provider value={listRenderId}>
                <FlushContext.Provider value={flushToState}>
                  <TrackItemContext.Provider value={itemTracker}>
                    {children}
                  </TrackItemContext.Provider>
                </FlushContext.Provider>
              </ListRenderIdContext.Provider>
            </ItemCountRefContext.Provider>
          );
        };
        return TrackItemProvider;
      }, []);
    };

    return { getItem, setItem, flushToState, useTrackItemProvider };
  }, []);
  itemTracker.trackedItems = trackedItems;

  return itemTracker;
};

export const useTrackItem = (data) => {
  const listRenderId = useContext(ListRenderIdContext);
  const itemCountRef = useContext(ItemCountRefContext);
  const itemTracker = useContext(TrackItemContext);
  const listRenderIdRef = useRef();
  const itemIndexRef = useRef();
  const dataRef = useRef();
  const prevListRenderId = listRenderIdRef.current;

  if (prevListRenderId === listRenderId) {
    const itemIndex = itemIndexRef.current;
    if (compareTwoJsValues(dataRef.current, data)) {
      return itemIndex;
    }
    itemTracker.setItem(itemIndex, data);
    dataRef.current = data;
    return itemIndex;
  }
  listRenderIdRef.current = listRenderId;
  const itemCount = itemCountRef.current;
  const itemIndex = itemCount;
  itemCountRef.current = itemIndex + 1;
  itemIndexRef.current = itemIndex;
  dataRef.current = data;
  itemTracker.setItem(itemIndex, data);
  return itemIndex;
};

export const useTrackedItems = () => {
  const itemTracker = useContext(ItemTrackerContext);
  const trackedItems = itemTracker.trackedItems;
  return trackedItems;
};

export const useTrackedItem = (itemIndex) => {
  const items = useTrackedItems();
  const item = items[itemIndex];
  return item;
};
