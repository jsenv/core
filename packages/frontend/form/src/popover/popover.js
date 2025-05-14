/**
 * I'll re-implement a custom validity api
 * because the native one is not configurable enough:
 *
 * - REALLY PAINFUL can't tell if the message is displayed or not, nor remove it with escape or something
 * - ok but complex: have to listen many evens in all directions to decide wether it's time to display the message or not
 * - ok but sitll not great: have to hack setCustomValidity to hold many validation messages
 * - ok but might be great to have some form of control on the design: can't customize the message
 */

/*

comme un input on peut rien mettre dedans il faut que:

- le tooltip suive l'élément dans le dom
donc idéalement le mettre dans le meme parent ou etre capable de suivre s'il bouge (what about scroll?)

*/

import { getScrollableParentSet } from "@jsenv/dom";

// https://druids.datadoghq.com/components/dialogs/Popover#example19

const css = /*css*/ `
.popover {
  display: block;
  overflow: visible;
  height: auto;
  position: relative;
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
}

.popover_content {
  position: relative;
  padding: 5px;
  border: 10px solid black;
  background: white;
}
`;

const html = /* html */ `
  <div class="popover">
    <style>
      ${css}
    </style>
    <div class="popover_content">Default message</div>
  </div>
`;
const createPopover = (content) => {
  const div = document.createElement("div");
  div.innerHTML = html;
  const popover = div.querySelector(".popover");
  const contentElement = popover.querySelector(".popover_content");
  contentElement.innerHTML = content;
  return popover;
};

const followPosition = (element, elementToFollow) => {
  const cleanupCallbackSet = new Set();
  const stop = () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };

  const viewportPadding = 0;

  const updatePosition = () => {
    const elementRect = elementToFollow.getBoundingClientRect();
    element.style.position = "fixed";

    const zoomLevel = window.devicePixelRatio || 1;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const isNearBottom = elementRect.bottom > viewportHeight - 100;

    if (isNearBottom) {
      // Position above the element instead of below
      element.style.top = `${elementRect.top - element.offsetHeight}px`;
    } else {
      element.style.top = `${elementRect.bottom}px`;
    }

    const edgePadding = viewportPadding * zoomLevel;

    // Calculate the ideal horizontal position (centered)
    let leftPos = elementRect.left + elementRect.width / 2;
    const popoverWidth = element.offsetWidth;
    const halfPopoverWidth = popoverWidth / 2;
    // Ensure popover doesn't go outside viewport on left or right
    if (leftPos - halfPopoverWidth < 0) {
      // Too far left, adjust to stay in viewport with some padding
      leftPos = halfPopoverWidth + edgePadding;
    } else if (leftPos + halfPopoverWidth > viewportWidth) {
      // Too far right, adjust to stay in viewport with some padding
      leftPos = viewportWidth - halfPopoverWidth - edgePadding;
    }
    element.style.left = `${leftPos}px`;
    element.style.transform = "translateX(-50%)";
  };
  updatePosition();

  let rafId = null;
  const schedulePositionUpdate = () => {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(updatePosition);
  };
  cleanupCallbackSet.add(() => {
    cancelAnimationFrame(rafId);
  });

  update_after_visibility_change: {
    const options = {
      root: null, // viewport
      rootMargin: "0px",
      threshold: [0, 1],
    };
    const intersectionObserver = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (entry.isIntersecting) {
        element.style.opacity = 1;
        schedulePositionUpdate();
      } else {
        element.style.opacity = 0;
      }
    }, options);
    intersectionObserver.observe(elementToFollow);
    cleanupCallbackSet.add(() => {
      intersectionObserver.disconnect();
    });
  }
  update_after_scroll: {
    const handleScroll = () => {
      schedulePositionUpdate();
    };

    const scrollableParentSet = getScrollableParentSet(elementToFollow);
    for (const scrollableParent of scrollableParentSet) {
      scrollableParent.addEventListener("scroll", handleScroll, {
        passive: true,
      });
      cleanupCallbackSet.add(() => {
        {
          scrollableParent.removeEventListener("scroll", handleScroll, {
            passive: true,
          });
        }
      });
    }
  }
  update_after_resize: {
    const resizeObserver = new ResizeObserver(() => {
      schedulePositionUpdate();
    });
    resizeObserver.observe(elementToFollow);
    cleanupCallbackSet.add(() => {
      resizeObserver.unobserve(elementToFollow);
    });
  }
  update_after_zoom_change: {
    if (viewportPadding) {
      const handleZoomChange = () => {
        schedulePositionUpdate();
      };
      window.addEventListener("resize", handleZoomChange);
      cleanupCallbackSet.add(() => {
        window.removeEventListener("resize", handleZoomChange);
      });
    }
  }

  return stop;
};

export const showPopover = (elementToFollow, innerHtml) => {
  const jsenvPopover = createPopover(innerHtml);
  const stopFollowingPosition = followPosition(jsenvPopover, elementToFollow);
  document.body.appendChild(jsenvPopover);

  const popoverRect = jsenvPopover.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  if (popoverRect.bottom > viewportHeight) {
    // Calculate how much we need to scroll to show the popover
    // without affecting its position relative to the element
    const scrollAmount = popoverRect.bottom - viewportHeight + 20; // Add 20px padding
    // Smoothly scroll just enough to show the popover
    window.scrollBy({
      top: scrollAmount,
      behavior: "smooth",
    });
  }

  return () => {
    stopFollowingPosition();
    document.body.removeChild(jsenvPopover);
  };
};
