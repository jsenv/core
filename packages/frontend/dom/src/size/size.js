export const measureSize = (element) => {
  const rect = element.getBoundingClientRect();
  const { width, height } = rect;
  return [width, height];
};

export const getMarginSizes = (element) => {
  const { marginLeft, marginRight, marginTop, marginBottom } =
    window.getComputedStyle(element, null);
  return {
    left: parseFloat(marginLeft),
    right: parseFloat(marginRight),
    top: parseFloat(marginTop),
    bottom: parseFloat(marginBottom),
  };
};

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

export const getPaddingSizes = (element) => {
  const { paddingLeft, paddingRight, paddingTop, paddingBottom } =
    window.getComputedStyle(element, null);
  return {
    left: parseFloat(paddingLeft),
    right: parseFloat(paddingRight),
    top: parseFloat(paddingTop),
    bottom: parseFloat(paddingBottom),
  };
};
