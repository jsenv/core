export const getBorderSizes = (element) => {
  const {
    borderLeftWidth,
    borderRightWidth,
    borderTopWidth,
    borderBottomWidth,
  } = window.getComputedStyle(element, null);
  return {
    left: parseFloat(borderLeftWidth),
    right: parseFloat(borderRightWidth),
    top: parseFloat(borderTopWidth),
    bottom: parseFloat(borderBottomWidth),
  };
};
