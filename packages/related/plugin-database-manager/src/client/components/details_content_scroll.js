const detailsWeakMap = new WeakMap();
const ensureDetailsScrollableTakeFullHeight = (detail) => {
  const updateHeight = () => {
    const detailsHeight = detail.offsetHeight;
    let summary = detail.querySelector("summary");
    let previousChildHeight = 0;

    for (const child of detail.children) {
      const childHeight = child.offsetHeight;
      if (child === summary) {
        previousChildHeight += childHeight;
        continue;
      }
      const computedStyle = window.getComputedStyle(child);
      if (
        computedStyle.overflowY === "auto" ||
        computedStyle.overflowY === "scroll"
      ) {
        const contentHeight = detailsHeight - previousChildHeight;
        child.style.height = `${contentHeight}px`;
      }
    }
  };

  updateHeight();
  const resizeObserver = new ResizeObserver(() => {
    updateHeight();
  });
  resizeObserver.observe(detail);

  detailsWeakMap.set(detail, () => {
    resizeObserver.disconnect();
  });
};

const observeDetailsDomMutation = () => {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const addedNode of mutation.addedNodes) {
        if (addedNode.nodeType !== Node.ELEMENT_NODE) {
          continue;
        }

        if (addedNode.nodeName === "DETAILS") {
          ensureDetailsScrollableTakeFullHeight(addedNode);
        }
        const nestedDetailsCollection = addedNode.querySelectorAll("details");
        if (nestedDetailsCollection.length > 0) {
          for (const nestedDetails of nestedDetailsCollection) {
            ensureDetailsScrollableTakeFullHeight(nestedDetails);
          }
        }
      }

      for (const removedNode of mutation.removedNodes) {
        const cleanup = detailsWeakMap.get(removedNode);
        if (cleanup) {
          cleanup();
          detailsWeakMap.delete(removedNode);
        }
      }
    }
  });
  // Observe the explorer for any DOM or attribute changes
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
};

if (document.readyState === "loading") {
  const detailsCollection = document.querySelectorAll("details");
  for (const details of detailsCollection) {
    ensureDetailsScrollableTakeFullHeight(details);
  }
  observeDetailsDomMutation();
  //   document.addEventListener("DOMContentLoaded", () => {
  //     const detailsCollection = document.querySelectorAll("details");
  //     for (const details of detailsCollection) {
  //       ensureDetailsScrollableTakeFullHeight(details);
  //     }

  //   });
} else {
  const detailsCollection = document.querySelectorAll("details");
  for (const details of detailsCollection) {
    ensureDetailsScrollableTakeFullHeight(details);
  }
  observeDetailsDomMutation();
}
