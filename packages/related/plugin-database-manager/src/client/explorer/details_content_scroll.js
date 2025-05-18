const detailsWeakMap = new WeakMap();
const ensureDetailsScrollableTakeFullHeight = (details) => {
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

    const detailsHeight = details.offsetHeight;
    let summaryHeight = summary.offsetHeight;
    let heightBefore = summaryHeight;
    for (const nextElementSibling of summaryNextSiblingSet) {
      const computedStyle = window.getComputedStyle(nextElementSibling);
      if (
        computedStyle.overflowY === "auto" ||
        computedStyle.overflowY === "scroll"
      ) {
        const contentHeight = detailsHeight - heightBefore;
        nextElementSibling.style.height = `${contentHeight}px`;
      }
    }
  };

  updateHeight();
  const resizeObserver = new ResizeObserver(() => {
    updateHeight();
  });
  resizeObserver.observe(details);

  detailsWeakMap.set(details, () => {
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
