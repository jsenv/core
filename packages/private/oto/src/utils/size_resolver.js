import { resolveCSSSize } from "@jsenv/dom";

export const resolveDimensions = ({
  width,
  height,
  availableWidth,
  availableHeight,
  fontSize,
  minWidth,
  maxWidth,
  minHeight,
  maxHeight,
}) => {
  const ratio = availableWidth / availableHeight;
  const minWidthResolved = resolveCSSSize(minWidth, {
    availableSize: availableWidth,
    fontSize,
  });
  const maxWidthResolved = resolveCSSSize(maxWidth, {
    availableSize: availableWidth,
    fontSize,
  });
  const minHeightResolved = resolveCSSSize(minHeight, {
    availableSize: availableHeight,
    fontSize,
  });
  const maxHeightResolved = resolveCSSSize(maxHeight, {
    availableSize: availableHeight,
    fontSize,
  });
  let widthResolved;
  if (width === "auto") {
    widthResolved = height * ratio;
  } else {
    widthResolved = resolveCSSSize(width, {
      availableSize: availableWidth,
      fontSize,
    });
  }
  if (minWidth && widthResolved < minWidthResolved) {
    widthResolved = minWidthResolved;
  }
  if (maxWidth && widthResolved > maxWidthResolved) {
    widthResolved = maxWidthResolved;
  }
  let heightResolved;
  if (height === "auto") {
    heightResolved = widthResolved / ratio;
  } else {
    heightResolved = resolveCSSSize(height, {
      availableSize: availableHeight,
      fontSize,
    });
  }
  if (minHeight && heightResolved < minHeightResolved) {
    heightResolved = minHeightResolved;
  }
  if (maxHeight && heightResolved > maxHeightResolved) {
    heightResolved = maxHeightResolved;
  }
  return [widthResolved, heightResolved];
};
