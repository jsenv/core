import { addAttributeEffect } from "../add_attribute_effect.js";
import { getHeight } from "./get_height.js";

addAttributeEffect("data-details-content-full-height", (details) => {
  const updateHeight = () => {
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

  const ontoggle = () => {
    updateHeight();
  };
  details.addEventListener("toggle", ontoggle);

  updateHeight();
  const resizeObserver = new ResizeObserver(() => {
    requestAnimationFrame(() => {
      updateHeight();
    });
  });
  resizeObserver.observe(details);
  return () => {
    details.removeEventListener("toggle", ontoggle);
    resizeObserver.disconnect();
  };
});
