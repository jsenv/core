export const getToolbarIframe = () => {
  const iframes = Array.from(window.parent.document.querySelectorAll("iframe"));
  return iframes.find((iframe) => iframe.contentWindow === window);
};

export const forceHideElement = (element) => {
  element.setAttribute("data-force-hide", "");
};

export const removeForceHideElement = (element) => {
  element.removeAttribute("data-force-hide");
};

export const setStyles = (element, styles) => {
  const restoreCallbackSet = new Set();

  for (const key of Object.keys(styles)) {
    const inlineValue = element.style[key];
    restoreCallbackSet.add(() => {
      if (inlineValue === "") {
        element.style.removeProperty(key);
      } else {
        element.style[key] = inlineValue;
      }
    });
  }
  for (const key of Object.keys(styles)) {
    const value = styles[key];
    element.style[key] = value;
  }
  return () => {
    for (const restoreCallback of restoreCallbackSet) {
      restoreCallback();
    }
    restoreCallbackSet.clear();
  };
};

export const setAttributes = (element, attributes) => {
  Object.keys(attributes).forEach((name) => {
    element.setAttribute(name, attributes[name]);
  });
};

export const getDocumentScroll = () => {
  return {
    x: document.documentElement.scrollLeft,
    y: document.documentElement.scrollTop,
  };
};

export const activateToolbarSection = (element) => {
  element.setAttribute("data-active", "");
};

export const deactivateToolbarSection = (element) => {
  element.removeAttribute("data-active");
};
