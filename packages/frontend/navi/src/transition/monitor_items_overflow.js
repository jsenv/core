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
 *   monitorItemsOverflow(containerElement);
 *
 * CSS example:
 *   .container { align-items: center; }
 *   .container[data-items-height-overflow] { align-items: flex-start; }
 */

import { createPubSub } from "@jsenv/dom";

const WIDTH_ATTRIBUTE_NAME = "data-items-width-overflow";
const HEIGHT_ATTRIBUTE_NAME = "data-items-height-overflow";
export const monitorItemsOverflow = (container) => {
  let widthIsOverflowing;
  let heightIsOverflowing;
  const onItemsWidthOverflowChange = () => {
    if (widthIsOverflowing) {
      container.setAttribute(WIDTH_ATTRIBUTE_NAME, "");
    } else {
      container.removeAttribute(WIDTH_ATTRIBUTE_NAME);
    }
  };
  const onItemsHeightOverflowChange = () => {
    if (heightIsOverflowing) {
      container.setAttribute(HEIGHT_ATTRIBUTE_NAME, "");
    } else {
      container.removeAttribute(HEIGHT_ATTRIBUTE_NAME);
    }
  };

  const update = () => {
    // Save current manual height constraint
    const prevWidth = container.style.width;
    const prevHeight = container.style.height;
    // Remove constraint → get true content dimension
    container.style.width = "auto";
    container.style.height = "auto";
    const naturalWidth = container.scrollWidth;
    const naturalHeight = container.scrollHeight;
    if (prevWidth) {
      container.style.width = prevWidth;
    } else {
      container.style.removeProperty("width");
    }
    if (prevHeight) {
      container.style.height = prevHeight;
    } else {
      container.style.removeProperty("height");
    }

    const lockedWidth = container.clientWidth;
    const lockedHeight = container.clientHeight;
    const currentWidthIsOverflowing = naturalWidth > lockedWidth;
    const currentHeightIsOverflowing = naturalHeight > lockedHeight;
    if (currentWidthIsOverflowing !== widthIsOverflowing) {
      widthIsOverflowing = currentWidthIsOverflowing;
      onItemsWidthOverflowChange();
    }
    if (currentHeightIsOverflowing !== heightIsOverflowing) {
      heightIsOverflowing = currentHeightIsOverflowing;
      onItemsHeightOverflowChange();
    }
  };

  const [teardown, addTeardown] = createPubSub();

  update();

  // mutation observer
  const mutationObserver = new MutationObserver(() => {
    update();
  });
  mutationObserver.observe(container, {
    childList: true,
    characterData: true,
  });
  addTeardown(() => {
    mutationObserver.disconnect();
  });

  // resize observer
  const resizeObserver = new ResizeObserver(update);
  resizeObserver.observe(container);
  addTeardown(() => {
    resizeObserver.disconnect();
  });

  const destroy = () => {
    teardown();
    container.removeAttribute(WIDTH_ATTRIBUTE_NAME);
    container.removeAttribute(HEIGHT_ATTRIBUTE_NAME);
  };
  return destroy;
};
