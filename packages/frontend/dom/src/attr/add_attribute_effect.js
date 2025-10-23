export const addAttributeEffect = (attributeName, effect) => {
  const cleanupWeakMap = new WeakMap();
  const applyEffect = (element) => {
    const cleanup = effect(element);
    cleanupWeakMap.set(
      element,
      typeof cleanup === "function" ? cleanup : () => {},
    );
  };

  const cleanupEffect = (element) => {
    const cleanup = cleanupWeakMap.get(element);
    if (cleanup) {
      cleanup();
      cleanupWeakMap.delete(element);
    }
  };

  const checkElement = (element) => {
    if (element.hasAttribute(attributeName)) {
      applyEffect(element);
    }
    const elementWithAttributeCollection = element.querySelectorAll(
      `[${attributeName}]`,
    );
    for (const elementWithAttribute of elementWithAttributeCollection) {
      applyEffect(elementWithAttribute);
    }
  };

  checkElement(document.body);
  const mutationObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        for (const addedNode of mutation.addedNodes) {
          if (addedNode.nodeType !== Node.ELEMENT_NODE) {
            continue;
          }
          checkElement(addedNode);
        }

        for (const removedNode of mutation.removedNodes) {
          if (removedNode.nodeType !== Node.ELEMENT_NODE) {
            continue;
          }

          // Clean up the removed node itself if it had the attribute
          if (
            removedNode.hasAttribute &&
            removedNode.hasAttribute(attributeName)
          ) {
            cleanupEffect(removedNode);
          }

          // Clean up any children of the removed node that had the attribute
          if (removedNode.querySelectorAll) {
            const elementsWithAttribute = removedNode.querySelectorAll(
              `[${attributeName}]`,
            );
            for (const element of elementsWithAttribute) {
              cleanupEffect(element);
            }
          }
        }
      }
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === attributeName
      ) {
        const element = mutation.target;
        if (element.hasAttribute(attributeName)) {
          applyEffect(element);
        } else {
          cleanupEffect(element);
        }
      }
    }
  });
  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [attributeName],
  });

  return () => {
    mutationObserver.disconnect();
    for (const cleanup of cleanupWeakMap.values()) {
      cleanup();
    }
    cleanupWeakMap.clear();
  };
};
