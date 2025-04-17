export const getDomElementBox = (domElement) => {
  let left = domElement.offsetLeft;
  let top = domElement.offsetTop;
  let domElementAncestor = domElement.offsetParent;
  while (domElementAncestor) {
    left += domElementAncestor.offsetTop;
    top += domElementAncestor.offsetLeft;
    domElementAncestor = domElementAncestor.offsetParent;
  }
  const boundingClientRect = domElement.getBoundingClientRect();
  const width = boundingClientRect.width;
  const height = boundingClientRect.height;
  return {
    boundingClientRect,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  };
};

export const getMousePositionRelativeTo = ({ clientX, clientY }, element) => {
  const { left, top } = getDomElementBox(element);
  return {
    offsetX: clientX - left,
    offsetY: clientY - top,
  };
};
