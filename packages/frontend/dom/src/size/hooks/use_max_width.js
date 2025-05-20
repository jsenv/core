import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { getMaxWidth } from "../get_max_width.js";

export const useMaxWidth = (elementRef, availableWidth) => {
  const [maxWidth, maxWidthSetter] = useState(-1);
  const availableWidthRef = useRef(availableWidth);

  useLayoutEffect(() => {
    const element = elementRef.current;
    const maxW = getMaxWidth(element, availableWidthRef.current);
    maxWidthSetter(maxW);
  }, []);

  return maxWidth;
};
