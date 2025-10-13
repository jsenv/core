import { getScrollContainer } from "../scroll/scroll_container.js";

export const stickyAsRelativeCoords = (
  element,
  referenceElement,
  { scrollContainer = getScrollContainer(element) } = {},
) => {
  const hasStickyLeftAttribute = element.hasAttribute("data-sticky-left");
  const hasTopStickyAttribute = element.hasAttribute("data-sticky-top");
  if (!hasStickyLeftAttribute && !hasTopStickyAttribute) {
    return null;
  }
  const elementRect = element.getBoundingClientRect();
  const referenceElementRect = referenceElement.getBoundingClientRect();
  const computedStyle = getComputedStyle(element);
  const isDocumentScrolling = scrollContainer === document.documentElement;

  let leftPosition;
  let topPosition;
  if (isDocumentScrolling) {
    // For document scrolling: check if element is currently stuck and calculate offset

    if (hasStickyLeftAttribute) {
      const cssLeftValue = parseFloat(computedStyle.left) || 0;
      const isStuckLeft = elementRect.left <= cssLeftValue;
      if (isStuckLeft) {
        const elementOffsetRelative =
          elementRect.left - referenceElementRect.left;
        leftPosition = elementOffsetRelative - cssLeftValue;
      } else {
        leftPosition = 0;
      }
    }
    if (hasTopStickyAttribute) {
      const cssTopValue = parseFloat(computedStyle.top) || 0;
      const isStuckTop = elementRect.top <= cssTopValue;
      if (isStuckTop) {
        const elementOffsetRelative =
          elementRect.top - referenceElementRect.top;
        topPosition = elementOffsetRelative - cssTopValue;
      } else {
        topPosition = 0;
      }
    }
    return [leftPosition, topPosition];
  }

  // For container scrolling: check if element is currently stuck and calculate offset
  const scrollContainerRect = scrollContainer.getBoundingClientRect();
  if (hasStickyLeftAttribute) {
    const cssLeftValue = parseFloat(computedStyle.left) || 0;
    // Check if element is stuck to the left edge of the scrollable container
    const isStuckLeft =
      elementRect.left <= scrollContainerRect.left + cssLeftValue;
    if (isStuckLeft) {
      // Element is stuck - calculate its offset relative to reference element
      const elementOffsetRelative =
        elementRect.left - referenceElementRect.left;
      leftPosition = elementOffsetRelative - cssLeftValue;
    } else {
      // Element is not stuck - behaves like position: relative with no offset
      leftPosition = 0;
    }
  }
  if (hasTopStickyAttribute) {
    const cssTopValue = parseFloat(computedStyle.top) || 0;
    // Check if element is stuck to the top edge of the scrollable container
    const isStuckTop = elementRect.top <= scrollContainerRect.top + cssTopValue;
    if (isStuckTop) {
      // Element is stuck - calculate its offset relative to reference element
      const elementOffsetRelative = elementRect.top - referenceElementRect.top;
      topPosition = elementOffsetRelative - cssTopValue;
    } else {
      // Element is not stuck - behaves like position: relative with no offset
      topPosition = 0;
    }
  }
  return [leftPosition, topPosition];
};
