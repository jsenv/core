import { useLayoutEffect, useState } from "preact/hooks";
import { getAvailableWidth } from "../get_available_width.js";

export const useAvailableWidth = (elementRef) => {
  const [availableWidth, availableWidthSetter] = useState(-1);

  useLayoutEffect(() => {
    const element = elementRef.current;
    const parentElement = element.parentElement;
    const resizeObserver = new ResizeObserver((entries) => {
      const [entry] = entries;
      const parentWidth = entry.contentRect.width;
      const availableW = getAvailableWidth(element, parentWidth);
      availableWidthSetter(availableW);
    });
    resizeObserver.observe(parentElement);
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return availableWidth;
};
