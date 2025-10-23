import { addAttributeEffect } from "../attr/add_attribute_effect.js";
import { getHeight } from "./get_height.js";

export const ensureDetailsContentFullHeight = (details) => {
  const updateHeight = () => {
    if (!details.open) {
      return;
    }
    let summary = details.querySelector("summary");
    const summaryNextSiblingSet = new Set();
    {
      let child = summary;
      let nextElementSibling;
      while ((nextElementSibling = child.nextElementSibling)) {
        nextElementSibling.style.height = "auto";
        summaryNextSiblingSet.add(nextElementSibling);
        child = nextElementSibling;
      }
    }

    const detailsHeight = getHeight(details);
    let summaryHeight = getHeight(summary);
    let heightBefore = summaryHeight;
    for (const nextElementSibling of summaryNextSiblingSet) {
      const contentHeight = detailsHeight - heightBefore;
      nextElementSibling.style.height = `${contentHeight}px`;
    }
  };

  updateHeight();

  const cleanupCallbackSet = new Set();
  update_on_size_change: {
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        updateHeight();
      });
    });
    resizeObserver.observe(details);
    cleanupCallbackSet.add(() => {
      resizeObserver.disconnect();
    });
  }
  update_on_toggle: {
    const ontoggle = () => {
      updateHeight();
    };
    details.addEventListener("toggle", ontoggle);
    cleanupCallbackSet.add(() => {
      details.removeEventListener("toggle", ontoggle);
    });
  }
  return () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };
};

addAttributeEffect("data-details-content-full-height", (details) => {
  return ensureDetailsContentFullHeight(details);
});
