import { useLayoutEffect, useState } from "preact/hooks";
import { getAvailableHeight } from "../get_available_height.js";

export const useAvailableHeight = (elementRef) => {
  const [availableHeight, availableHeightSetter] = useState(-1);

  useLayoutEffect(() => {
    const element = elementRef.current;
    const parentElement = element.parentElement;
    let raf;
    const resizeObserver = new ResizeObserver((entries) => {
      const [entry] = entries;
      const parentHeight = entry.contentRect.height;
      const availableH = getAvailableHeight(element, parentHeight);
      raf = requestAnimationFrame(() => {
        availableHeightSetter(availableH);
      });
    });
    resizeObserver.observe(parentElement);
    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  return availableHeight;
};
