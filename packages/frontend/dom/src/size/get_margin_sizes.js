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
