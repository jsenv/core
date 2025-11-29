import { createRef } from "preact";
import { useMemo, useRef } from "preact/hooks";

export const useRefArray = (items, keyFromItem) => {
  const refMapRef = useRef(new Map());
  const previousKeySetRef = useRef(new Set());

  return useMemo(() => {
    const refMap = refMapRef.current;
    const previousKeySet = previousKeySetRef.current;
    const currentKeySet = new Set();
    const refArray = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const key = keyFromItem(item);
      currentKeySet.add(key);

      const refForKey = refMap.get(key);
      if (refForKey) {
        refArray[i] = refForKey;
      } else {
        const newRef = createRef();
        refMap.set(key, newRef);
        refArray[i] = newRef;
      }
    }

    for (const key of previousKeySet) {
      if (!currentKeySet.has(key)) {
        refMap.delete(key);
      }
    }
    previousKeySetRef.current = currentKeySet;

    return refArray;
  }, [items]);
};
