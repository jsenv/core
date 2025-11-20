/**
 * Fix alignment behavior for flex/grid containers that use `height: 100%`.
 *
 * Context:
 * - When a flex/grid container has `height: 100%`, it is "height-locked".
 * - If its content becomes taller than the container, alignment rules like
 *   `align-items: center` will cause content to be partially clipped.
 *
 * Goal:
 * - Center content only when it fits.
 * - Align content at start when it overflows.
 *
 * How:
 * - Temporarily remove height-constraint (`height:auto`) to measure natural height.
 * - Compare natural height to container height.
 * - Add/remove an attribute so CSS can adapt alignment.
 *
 * Usage:
 *   monitorHeightOverflow(containerElement);
 *
 * CSS example:
 *   .container { align-items: center; }
 *   .container[data-items-height-overflow] { align-items: flex-start; }
 */

const ATTRIBUTE_NAME = "data-items-height-overflow";
export const monitorItemsHeightOverflow = (container) => {
  let lastState = null;

  const update = () => {
    // Save current manual height constraint
    const prevHeight = container.style.height;

    // Remove constraint → get true content height
    container.style.height = "auto";
    const naturalHeight = container.scrollHeight;

    // Restore locked height:100%
    if (prevHeight) {
      container.style.height = prevHeight;
    } else {
      container.style.removeProperty("height");
    }

    const lockedHeight = container.clientHeight;
    const isOverflowing = naturalHeight > lockedHeight;

    if (isOverflowing !== lastState) {
      if (isOverflowing) {
        container.setAttribute(ATTRIBUTE_NAME, "");
      } else {
        container.removeAttribute(ATTRIBUTE_NAME);
      }
      lastState = isOverflowing;
    }
  };

  const resizeObserver = new ResizeObserver(update);
  resizeObserver.observe(container);
  update();

  const destroy = () => {
    resizeObserver.disconnect();
    container.removeAttribute(ATTRIBUTE_NAME);
  };
  return destroy;
};
