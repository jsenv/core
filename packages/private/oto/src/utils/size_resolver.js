export const resolveSize = (
  size,
  { availableSize, fontSize, autoIsRelativeToFont },
) => {
  if (typeof size === "string") {
    if (size === "auto") {
      return autoIsRelativeToFont ? fontSize : availableSize;
    }
    if (size.endsWith("%")) {
      return availableSize * (parseFloat(size) / 100);
    }
    if (size.endsWith("px")) {
      return parseFloat(size);
    }
    if (size.endsWith("em")) {
      return parseFloat(size) * fontSize;
    }
    return parseFloat(size);
  }
  return size;
};

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
  const minWidthResolved = resolveSize(minWidth, {
    availableSize: availableWidth,
    fontSize,
  });
  const maxWidthResolved = resolveSize(maxWidth, {
    availableSize: availableWidth,
    fontSize,
  });
  const minHeightResolved = resolveSize(minHeight, {
    availableSize: availableHeight,
    fontSize,
  });
  const maxHeightResolved = resolveSize(maxHeight, {
    availableSize: availableHeight,
    fontSize,
  });
  let widthResolved;
  if (width === "auto") {
    widthResolved = height * ratio;
  } else {
    widthResolved = resolveSize(width, {
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
    heightResolved = resolveSize(height, {
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
