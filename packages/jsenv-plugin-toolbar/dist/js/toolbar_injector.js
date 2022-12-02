const updateIframeOverflowOnParentWindow = () => {
  if (!window.parent) {
    // can happen while parent iframe reloads
    return;
  }
  const aTooltipIsOpened = document.querySelector("[data-tooltip-visible]") || document.querySelector("[data-tooltip-auto-visible]");
  const settingsAreOpened = document.querySelector("#settings[data-active]");
  if (aTooltipIsOpened || settingsAreOpened) {
    enableIframeOverflowOnParentWindow();
  } else {
    disableIframeOverflowOnParentWindow();
  }
};
let iframeOverflowEnabled = false;
const enableIframeOverflowOnParentWindow = () => {
  if (iframeOverflowEnabled) return;
  iframeOverflowEnabled = true;
  const iframe = getToolbarIframe();
  const transitionDuration = iframe.style.transitionDuration;
  setStyles(iframe, {
    "height": "100%",
    "transition-duration": "0ms"
  });
  if (transitionDuration) {
    setTimeout(() => {
      setStyles(iframe, {
        "transition-duration": transitionDuration
      });
    });
  }
};
const disableIframeOverflowOnParentWindow = () => {
  if (!iframeOverflowEnabled) return;
  iframeOverflowEnabled = false;
  const iframe = getToolbarIframe();
  const transitionDuration = iframe.style.transitionDuration;
  setStyles(iframe, {
    "height": "40px",
    "transition-duration": "0ms"
  });
  if (transitionDuration) {
    setTimeout(() => {
      setStyles(iframe, {
        "transition-duration": transitionDuration
      });
    });
  }
};
const getToolbarIframe = () => {
  const iframes = Array.from(window.parent.document.querySelectorAll("iframe"));
  return iframes.find(iframe => iframe.contentWindow === window);
};
const forceHideElement = element => {
  element.setAttribute("data-force-hide", "");
};
const removeForceHideElement = element => {
  element.removeAttribute("data-force-hide");
};
const setStyles = (element, styles) => {
  const elementStyle = element.style;
  const restoreStyles = Object.keys(styles).map(styleName => {
    let restore;
    if (styleName in elementStyle) {
      const currentStyle = elementStyle[styleName];
      restore = () => {
        elementStyle[styleName] = currentStyle;
      };
    } else {
      restore = () => {
        delete elementStyle[styleName];
      };
    }
    elementStyle[styleName] = styles[styleName];
    return restore;
  });
  return () => {
    restoreStyles.forEach(restore => restore());
  };
};
const setAttributes = (element, attributes) => {
  Object.keys(attributes).forEach(name => {
    element.setAttribute(name, attributes[name]);
  });
};
const toolbarSectionIsActive = element => {
  return element.hasAttribute("data-active");
};
const activateToolbarSection = element => {
  element.setAttribute("data-active", "");
};
const deactivateToolbarSection = element => {
  element.removeAttribute("data-active");
};

const jsenvLogoSvgUrl = new URL("../other/jsenv_logo.svg", import.meta.url);
const injectToolbar = async ({
  toolbarUrl,
  logs = false
}) => {
  if (document.readyState !== "complete") {
    await new Promise(resolve => {
      window.addEventListener("load", resolve);
    });
  }
  await new Promise(resolve => {
    if (window.requestIdleCallback) {
      window.requestIdleCallback(resolve, {
        timeout: 400
      });
    } else {
      window.requestAnimationFrame(resolve);
    }
  });
  const placeholder = getToolbarPlaceholder();
  const iframe = document.createElement("iframe");
  setAttributes(iframe, {
    tabindex: -1,
    // sandbox: "allow-forms allow-modals allow-pointer-lock allow-popups allow-presentation allow-same-origin allow-scripts allow-top-navigation-by-user-activation",
    // allow: "accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; microphone; midi; payment; vr",
    allowtransparency: true
  });
  setStyles(iframe, {
    "position": "fixed",
    "zIndex": 1000,
    "bottom": 0,
    "left": 0,
    "width": "100%",
    "height": 0,
    /* ensure toolbar children are not focusable when hidden */
    "visibility": "hidden",
    "transition-duration": "300ms",
    "transition-property": "height, visibility",
    "border": "none"
  });
  const iframeLoadedPromise = iframeToLoadedPromise(iframe);
  // set iframe src BEFORE putting it into the DOM (prevent firefox adding an history entry)
  iframe.setAttribute("src", toolbarUrl);
  placeholder.parentNode.replaceChild(iframe, placeholder);
  addToolbarEventCallback(iframe, "toolbar_ready", () => {
    sendCommandToToolbar(iframe, "renderToolbar", {
      logs
    });
  });
  await iframeLoadedPromise;
  iframe.removeAttribute("tabindex");
  const div = document.createElement("div");
  div.innerHTML = `
<div id="jsenv-toolbar-trigger">
  <svg id="jsenv-toolbar-trigger-icon">
    <use xlink:href="${jsenvLogoSvgUrl}#jsenv_logo"></use>
  </svg>
  <style>
    #jsenv-toolbar-trigger {
      display: block;
      overflow: hidden;
      position: fixed;
      z-index: 1000;
      bottom: -32px;
      right: 20px;
      height: 40px;
      width: 40px;
      padding: 0;
      margin: 0;
      border-radius: 5px 5px 0 0;
      border: 1px solid rgba(0, 0, 0, 0.33);
      border-bottom: none;
      box-shadow: 0px 0px 6px 2px rgba(0, 0, 0, 0.46);
      background: transparent;
      text-align: center;
      transition: 600ms;
    }

    #jsenv-toolbar-trigger:hover {
      cursor: pointer;
    }

    #jsenv-toolbar-trigger[data-expanded] {
      bottom: 0;
    }

    #jsenv-toolbar-trigger-icon {
      width: 35px;
      height: 35px;
      opacity: 0;
      transition: 600ms;
    }

    #jsenv-toolbar-trigger[data-expanded] #jsenv-toolbar-trigger-icon {
      opacity: 1;
    }
  </style>
</div>`;
  const toolbarTrigger = div.firstElementChild;
  iframe.parentNode.appendChild(toolbarTrigger);
  let timer;
  toolbarTrigger.onmouseenter = () => {
    toolbarTrigger.setAttribute("data-animate", "");
    timer = setTimeout(expandToolbarTrigger, 500);
  };
  toolbarTrigger.onmouseleave = () => {
    clearTimeout(timer);
    collapseToolbarTrigger();
  };
  toolbarTrigger.onfocus = () => {
    toolbarTrigger.removeAttribute("data-animate");
    expandToolbarTrigger();
  };
  toolbarTrigger.onblur = () => {
    toolbarTrigger.removeAttribute("data-animate");
    clearTimeout(timer);
    collapseToolbarTrigger();
  };
  toolbarTrigger.onclick = () => {
    sendCommandToToolbar(iframe, "showToolbar");
  };
  const showToolbarTrigger = () => {
    toolbarTrigger.style.display = "block";
  };
  const hideToolbarTrigger = () => {
    toolbarTrigger.style.display = "none";
  };
  const expandToolbarTrigger = () => {
    toolbarTrigger.setAttribute("data-expanded", "");
  };
  const collapseToolbarTrigger = () => {
    toolbarTrigger.removeAttribute("data-expanded", "");
  };
  hideToolbarTrigger();
  addToolbarEventCallback(iframe, "toolbar-visibility-change", visible => {
    if (visible) {
      hideToolbarTrigger();
    } else {
      showToolbarTrigger();
    }
  });
  return iframe;
};
const addToolbarEventCallback = (iframe, eventName, callback) => {
  const messageEventCallback = messageEvent => {
    const {
      data
    } = messageEvent;
    if (typeof data !== "object") {
      return;
    }
    const {
      __jsenv__
    } = data;
    if (!__jsenv__) {
      return;
    }
    if (__jsenv__.event !== eventName) {
      return;
    }
    callback(__jsenv__.data);
  };
  window.addEventListener("message", messageEventCallback, false);
  return () => {
    window.removeEventListener("message", messageEventCallback, false);
  };
};
const sendCommandToToolbar = (iframe, command, ...args) => {
  iframe.contentWindow.postMessage({
    __jsenv__: {
      command,
      args
    }
  }, window.origin);
};
const getToolbarPlaceholder = () => {
  const placeholder = queryPlaceholder();
  if (placeholder) {
    if (document.body.contains(placeholder)) {
      return placeholder;
    }
    // otherwise iframe would not be visible because in <head>
    console.warn("element with [data-jsenv-toolbar-placeholder] must be inside document.body");
    return createTooolbarPlaceholder();
  }
  return createTooolbarPlaceholder();
};
const queryPlaceholder = () => {
  return document.querySelector("[data-jsenv-toolbar-placeholder]");
};
const createTooolbarPlaceholder = () => {
  const placeholder = document.createElement("span");
  document.body.appendChild(placeholder);
  return placeholder;
};
const iframeToLoadedPromise = iframe => {
  return new Promise(resolve => {
    const onload = () => {
      iframe.removeEventListener("load", onload, true);
      resolve();
    };
    iframe.addEventListener("load", onload, true);
  });
};

export { activateToolbarSection as a, deactivateToolbarSection as d, forceHideElement as f, getToolbarIframe as g, injectToolbar, removeForceHideElement as r, setStyles as s, toolbarSectionIsActive as t, updateIframeOverflowOnParentWindow as u };
