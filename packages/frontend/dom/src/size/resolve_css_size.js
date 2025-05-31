export const resolveCSSSize = (
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
    if (size.endsWith("rem")) {
      return (
        parseFloat(size) * getComputedStyle(document.documentElement).fontSize
      );
    }
    if (size.endsWith("vw")) {
      return (parseFloat(size) / 100) * window.innerWidth;
    }
    if (size.endsWith("vh")) {
      return (parseFloat(size) / 100) * window.innerHeight;
    }
    return parseFloat(size);
  }
  return size;
};
