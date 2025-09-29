// https://github.com/reach/reach-ui/tree/b3d94d22811db6b5c0f272b9a7e2e3c1bb4699ae/packages/descendants

import { createContext } from "preact";
import { useContext, useMemo, useRef } from "preact/hooks";

import { compareTwoJsValues } from "../../utils/compare_two_js_values.js";

const ItemTrackerContext = createContext();
export const ItemTrackerProvider = ItemTrackerContext.Provider;

const TrackItemContext = createContext();
const ItemCountRefContext = createContext();
const ListRenderIdContext = createContext();

export const useItemTracker = () => {
  const itemsRef = useRef([]);
  const itemCountRef = useRef();
  const itemTracker = useMemo(() => {
    const setItem = (index, value) => {
      itemsRef.current[index] = value;
    };

    const useTrackItemProvider = () => {
      itemsRef.current = [];
      itemCountRef.current = 0;
      const listRenderId = {};
      return useMemo(() => {
        const TrackItemProvider = ({ children }) => {
          return (
            <ItemCountRefContext.Provider value={itemCountRef}>
              <ListRenderIdContext.Provider value={listRenderId}>
                <TrackItemContext.Provider value={itemTracker}>
                  {children}
                </TrackItemContext.Provider>
              </ListRenderIdContext.Provider>
            </ItemCountRefContext.Provider>
          );
        };
        return TrackItemProvider;
      }, []);
    };

    return { setItem, useTrackItemProvider };
  }, []);

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
  const itemTracker = useContext(TrackItemContext);
  const items = itemTracker.itemsRef.current;
  return items;
};
export const useTrackedItem = (itemIndex) => {
  const items = useTrackedItems();
  const item = items[itemIndex];
  return item;
};
