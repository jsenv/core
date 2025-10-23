// https://davidwalsh.name/detect-scrollbar-width
export const measureScrollbar = (scrollableElement) => {
  const hasXScrollbar =
    scrollableElement.scrollHeight > scrollableElement.clientHeight;
  const hasYScrollbar =
    scrollableElement.scrollWidth > scrollableElement.clientWidth;
  if (!hasXScrollbar && !hasYScrollbar) {
    return [0, 0];
  }
  const scrollDiv = document.createElement("div");
  scrollDiv.style.cssText = `position: absolute; width: 100px; height: 100px; overflow: scroll; pointer-events: none; visibility: hidden;`;
  scrollableElement.appendChild(scrollDiv);
  const scrollbarWidth = scrollDiv.offsetWidth - scrollDiv.clientWidth;
  const scrollbarHeight = scrollDiv.offsetHeight - scrollDiv.clientHeight;
  scrollableElement.removeChild(scrollDiv);
  return [
    hasXScrollbar ? scrollbarWidth : 0,
    hasYScrollbar ? scrollbarHeight : 0,
  ];
};
