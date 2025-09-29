// https://github.com/reach/reach-ui/tree/b3d94d22811db6b5c0f272b9a7e2e3c1bb4699ae/packages/descendants
// https://github.com/pacocoursey/use-descendants/tree/master

import { createContext } from "preact";
import { useContext, useMemo, useRef } from "preact/hooks";

import { compareTwoJsValues } from "../../utils/compare_two_js_values.js";

const ItemTrackerContext = createContext();
export const ItemTrackerProvider = ItemTrackerContext.Provider;

const TrackItemContext = createContext();
const ItemCountRefContext = createContext();
const ListRenderIdContext = createContext();

export const useItemTracker = () => {
  const itemMapRef = useRef(new Map());
  const itemMap = itemMapRef.current;
  const itemCountRef = useRef();
  const itemTracker = useMemo(() => {
    const getItem = (itemId) => {
      const info = itemMap.get(itemId);
      return info;
    };

    const setItem = (itemId, index, value) => {
      itemMap.set(itemId, { index, value });
    };

    const useTrackItemProvider = () => {
      itemMap.clear();
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

    return { itemMap, getItem, setItem, useTrackItemProvider };
  }, []);

  return itemTracker;
};

const randomId = () => Math.random().toString(36).substr(2, 9);

export const useTrackItem = (data) => {
  const componentIdRef = useRef();
  if (!componentIdRef.current) {
    componentIdRef.current = randomId();
  }
  const componentId = componentIdRef.current;
  console.log({ componentId });

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
    itemTracker.setItem(componentId, itemIndex, data);
    dataRef.current = data;
    return itemIndex;
  }
  listRenderIdRef.current = listRenderId;
  const itemCount = itemCountRef.current;
  const itemIndex = itemCount;
  itemCountRef.current = itemIndex + 1;
  itemIndexRef.current = itemIndex;
  dataRef.current = data;
  itemTracker.setItem(componentId, itemIndex, data);
  return itemIndex;
};

export const useTrackedItems = () => {
  const itemTracker = useContext(ItemTrackerContext);
  const items = [];
  for (const [, info] of itemTracker.itemMap) {
    items[info.index] = info.value;
  }
  return items;
};
export const useTrackedItem = (itemIndex) => {
  const items = useTrackedItems();
  const item = items[itemIndex];
  return item;
};
