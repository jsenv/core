import { useLayoutEffect, useState } from "preact/hooks";
import { getAvailableHeight } from "../get_available_height.js";

export const useAvailableHeight = (elementRef) => {
  const [availableHeight, availableHeightSetter] = useState(-1);

  useLayoutEffect(() => {
    const element = elementRef.current;
    const parentElement = element.parentElement;
    const resizeObserver = new ResizeObserver((entries) => {
      const [entry] = entries;
      const { width, height } = entry.contentRect;
      const availableH = getAvailableHeight(element, [width, height]);
      availableHeightSetter(availableH);
    });
    resizeObserver.observe(parentElement);
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return availableHeight;
};
