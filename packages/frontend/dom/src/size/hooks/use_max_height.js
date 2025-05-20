import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { getMaxHeight } from "../get_max_height.js";

export const useMaxHeight = (elementRef, availableHeight) => {
  const [maxHeight, maxHeightSetter] = useState(-1);
  const availableHeightRef = useRef(availableHeight);

  useLayoutEffect(() => {
    const element = elementRef.current;
    const maxH = getMaxHeight(element, availableHeightRef.current);
    maxHeightSetter(maxH);
  }, []);

  return maxHeight;
};
