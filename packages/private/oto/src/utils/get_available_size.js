export const getAvailableSize = (element) => {
  const { paddingSizes, borderSizes } = getPaddingAndBorderSizes(element);
  const boundingClientRect = element.getBoundingClientRect();
  let availableWidth = boundingClientRect.width;
  let availableHeight = boundingClientRect.height;
  availableWidth -=
    paddingSizes.left +
    paddingSizes.right +
    borderSizes.left +
    borderSizes.right;
  availableHeight -=
    paddingSizes.top +
    paddingSizes.bottom +
    borderSizes.top +
    borderSizes.bottom;
  if (availableWidth < 0) {
    availableWidth = 0;
  }
  if (availableHeight < 0) {
    availableHeight = 0;
  }
  return [availableWidth, availableHeight];
};

export const getPaddingAndBorderSizes = (element) => {
  const {
    paddingLeft,
    paddingRight,
    paddingTop,
    paddingBottom,
    borderLeftWidth,
    borderRightWidth,
    borderTopWidth,
    borderBottomWidth,
  } = window.getComputedStyle(element, null);
  return {
    paddingSizes: {
      left: parseFloat(paddingLeft),
      right: parseFloat(paddingRight),
      top: parseFloat(paddingTop),
      bottom: parseFloat(paddingBottom),
    },
    borderSizes: {
      left: parseFloat(borderLeftWidth),
      right: parseFloat(borderRightWidth),
      top: parseFloat(borderTopWidth),
      bottom: parseFloat(borderBottomWidth),
    },
  };
};
