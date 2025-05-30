import { useLayoutEffect, useState } from "preact/hooks";

export const useResizeStatus = (elementRef, { as = "number" } = {}) => {
  const [resizing, setIsResizing] = useState(false);
  const [resizeWidth, setResizeWidth] = useState(null);
  const [resizeHeight, setResizeHeight] = useState(null);

  useLayoutEffect(() => {
    const element = elementRef.current;

    const onresizestart = (e) => {
      const sizeInfo = e.detail;
      setResizeWidth(
        as === "number" ? sizeInfo.width : sizeInfo.widthAsPercentage,
      );
      setResizeHeight(
        as === "number" ? sizeInfo.height : sizeInfo.heightAsPercentage,
      );
      setIsResizing(true);
    };
    const onresize = (e) => {
      const sizeInfo = e.detail;
      setResizeWidth(
        as === "number" ? sizeInfo.width : sizeInfo.widthAsPercentage,
      );
      setResizeHeight(
        as === "number" ? sizeInfo.height : sizeInfo.heightAsPercentage,
      );
    };
    const onresizeend = () => {
      setIsResizing(false);
    };

    element.addEventListener("resizestart", onresizestart);
    element.addEventListener("resize", onresize);
    element.addEventListener("resizeend", onresizeend);
    return () => {
      element.removeEventListener("resizestart", onresizestart);
      element.removeEventListener("resize", onresize);
      element.removeEventListener("resizeend", onresizeend);
    };
  }, [as]);

  return {
    resizing,
    resizeWidth,
    resizeHeight,
  };
};

// to use when width is set as percentage
export const useInitialWidth = (width, elementRef) => {
  const [initialWidth, setInitialWidth] = useState(null);
  useLayoutEffect(() => {
    const element = elementRef.current;
    const availableWidth = element.parentElement.offsetWidth;
    setInitialWidth(
      width.endsWith("%") ? (parseFloat(width) / 100) * availableWidth : width,
    );
  }, [width]);
  return initialWidth;
};
