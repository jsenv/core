import { useLayoutEffect, useState } from "preact/hooks";

export const useResizeStatus = (elementRef) => {
  const [resizing, setIsResizing] = useState(false);
  const [resizeWidth, setResizeWidth] = useState(null);
  const [resizeHeight, setResizeHeight] = useState(null);

  useLayoutEffect(() => {
    const element = elementRef.current;

    const onresizestart = (e) => {
      const sizeInfo = e.detail;
      setResizeWidth(sizeInfo.width);
      setResizeHeight(sizeInfo.height);
      setIsResizing(true);
    };
    const onresize = (e) => {
      const sizeInfo = e.detail;
      setResizeWidth(sizeInfo.width);
      setResizeHeight(sizeInfo.height);
    };
    const onresizeend = () => {
      setResizeWidth(null);
      setResizeHeight(null);
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
  }, []);

  return {
    resizing,
    resizeWidth,
    resizeHeight,
  };
};
