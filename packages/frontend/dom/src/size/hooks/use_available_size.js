import { useLayoutEffect, useState } from "preact/hooks";
import { getAvailableSize } from "../size.js";

export const useAvailableSize = (elementRef) => {
  const [availableWidth, availableWidthSetter] = useState(-1);
  const [availableHeight, availableHeightSetter] = useState(-1);

  useLayoutEffect(() => {
    const element = elementRef.current;
    const parentElement = element.parentElement;
    const resizeObserver = new ResizeObserver((entries) => {
      const [entry] = entries;
      const { width, height } = entry.contentRect;
      const available = getAvailableSize(element, [width, height]);
      availableWidthSetter(available[0]);
      availableHeightSetter(available[1]);
    });
    resizeObserver.observe(parentElement);
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return [availableWidth, availableHeight];
};
