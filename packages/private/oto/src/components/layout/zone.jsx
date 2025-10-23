/**
 * This component allow to position and dimension itself as follow:
 * x: "start" | "center" | "end" | number | string (e.g. "50%") | "fit-content"
 * y: "start" | "center" | "end" | number | string (e.g. "50%") | "fit-content"
 * width: number | string (e.g. "50%") | "auto"
 * height: number | string (e.g. "50%") | "auto"
 * aspectRatio: number
 *
 * Best parts
 * - "start", "center", "end" position allow to position the box
 * dynamically depending on it size
 * - aspectRatio allow width or height to be dertermined accoring to the other
 * - width height cannot exceed parent size, even when computed from aspectRatio
 *
 * Technical details
 *
 * useLayoutEffect are called from child to parent
 * https://github.com/facebook/react/issues/15281
 * But child needs parent size to be determined to position itself
 * (happens when <Box> elements are nested)
 * To solve this, we use a <LayoutEffectParentBeforeAnyChild /> rendered before any child
 * see https://gist.github.com/nikparo/33544fe0228dd5aa6f0de8d03e96c378
 *
 * This allow to call useLayoutEffect in the expected order
 * However when component is re-rendered it must re-render the children
 * so that they are all respecting the new positions&dimensions
 * To achieve this we use a state variable shouldRerender
 *
 * We could use solely shouldRerender state but that means on the first render
 * all children would need a re-render to start rendering. With the current technic
 * we got the best of both worlds where first render is immediate and subsequent renders
 * are properly re-rendering children
 */

import { getBorderSizes, getPaddingSizes } from "@jsenv/dom";
import { toChildArray } from "preact";
import { useLayoutEffect, useRef } from "preact/hooks";

export const Zone = ({
  name,
  elementRef = useRef(),
  visible = true,
  width,
  height,
  aspectRatio = 1,
  x = "start",
  y = "start",
  children,
  ...props
}) => {
  if (width === "auto" && height === "auto") {
    throw new Error("width and height cannot both be auto");
  }
  if (height === undefined) {
    height = "auto";
    if (width === undefined) {
      width = "100%";
    }
  } else if (width === undefined) {
    width = "auto";
  }

  const widthDependsOnChildren = width === "fit-content";
  const heightDependsOnChildren = height === "fit-content";
  children = toChildArray(children);
  useLayoutEffect(() => {
    updateDimenionAndPosition({
      // name,
      element: elementRef.current,
      width,
      height,
      aspectRatio,
      x,
      y,
    });
  }, [
    // name
    width,
    height,
    aspectRatio,
    x,
    y,
    ...children,
  ]);

  return (
    <div
      {...props}
      name={name}
      ref={elementRef}
      style={{
        ...props.style,
        position: "absolute",
        display: "inline-flex",
        width: widthDependsOnChildren ? "auto" : width,
        height: heightDependsOnChildren ? "auto" : height,
        visibility: visible ? "visible" : "hidden",
      }}
    >
      {children}
    </div>
  );
};

const updateDimenionAndPosition = ({
  // name,
  element,
  width,
  height,
  aspectRatio,
  x,
  y,
}) => {
  const offsetParent = element.offsetParent;
  let availableWidth = offsetParent.clientWidth;
  let availableHeight = offsetParent.clientHeight;
  const paddingSizes = getPaddingSizes(offsetParent);
  const borderSizes = getBorderSizes(element);
  availableWidth -= paddingSizes.left + paddingSizes.right;
  availableHeight -= paddingSizes.top + paddingSizes.bottom;

  let widthComputed;
  if (typeof width === "number") {
    widthComputed = width;
  } else if (width === "fit-content") {
    element.style.width = "auto"; // important when re-rendering, otherwise the width is fixed
    widthComputed = element.clientWidth + borderSizes.left + borderSizes.right;
  } else if (typeof width === "string" && width.endsWith("%")) {
    widthComputed = availableWidth * (parseInt(width) / 100);
  }
  let heightComputed;
  if (typeof height === "number") {
    heightComputed = height;
  } else if (height === "fit-content") {
    element.style.height = "auto"; // important when re-rendering, otherwise the height is fixed
    heightComputed =
      element.clientHeight + borderSizes.top + borderSizes.bottom;
  } else if (typeof height === "string" && height.endsWith("%")) {
    heightComputed = availableHeight * (parseInt(height) / 100);
  }
  if (width === "auto") {
    widthComputed = heightComputed * aspectRatio;
    if (widthComputed > availableWidth) {
      // ensure cannot exceed available width
      widthComputed = availableWidth;
      heightComputed = widthComputed / aspectRatio;
    }
  }
  if (height === "auto") {
    heightComputed = widthComputed / aspectRatio;
    if (heightComputed > availableHeight) {
      // ensure cannot exceed available height
      heightComputed = availableHeight;
      widthComputed = heightComputed * aspectRatio;
    }
  }
  let xComputed;
  if (x === "start") {
    xComputed = 0;
  } else if (x === "center") {
    xComputed = (availableWidth - widthComputed) / 2;
  } else if (x === "end") {
    xComputed = availableWidth - widthComputed;
  } else if (typeof x === "number") {
    xComputed = x;
  } else if (typeof x === "string" && x.endsWith("%")) {
    xComputed = availableWidth * (parseInt(x) / 100);
  }
  xComputed += paddingSizes.left;
  let yComputed;
  if (y === "start") {
    yComputed = 0;
  } else if (y === "center") {
    yComputed = (availableHeight - heightComputed) / 2;
  } else if (y === "end") {
    yComputed = availableHeight - heightComputed;
  } else if (typeof y === "number") {
    yComputed = y;
  } else if (typeof y === "string" && y.endsWith("%")) {
    yComputed = availableHeight * (parseInt(y) / 100);
  }
  yComputed += paddingSizes.top;
  element.style.left = `${xComputed}px`;
  element.style.top = `${yComputed}px`;
  element.style.width = `${widthComputed}px`;
  element.style.height = `${heightComputed}px`;
};
