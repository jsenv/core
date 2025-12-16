const jsenvLogoSvgUrl = new URL("./ui/jsenv_logo.svg", import.meta.url);

export const injectToolbar = async ({
  toolbarUrl,
  logLevel,
  theme,
  opened,
  autoreload,
  animationsEnabled,
  notificationsEnabled,
}) => {
  let iframe;
  let resolveToolbarReadyPromise;
  const toolbarReadyPromise = new Promise((resolve) => {
    resolveToolbarReadyPromise = resolve;
  });
  const openToolbar = async () => {
    await toolbarReadyPromise;
    sendCommandToToolbar(iframe, "openToolbar");
  };
  const closeToolbar = async () => {
    await toolbarReadyPromise;
    sendCommandToToolbar(iframe, "closeToolbar");
  };
  window.__jsenv_toolbar__ = {
    open: openToolbar,
    close: closeToolbar,
  };

  if (document.readyState !== "complete") {
    if (logLevel === "debug") {
      console.debug('toolbar injection: wait for window "load"');
    }
    await new Promise((resolve) => {
      window.addEventListener("load", resolve);
    });
  }
  if (logLevel === "debug") {
    console.debug("toolbar injection: wait idleCallback");
  }
  await new Promise((resolve) => {
    if (window.requestIdleCallback) {
      window.requestIdleCallback(resolve, { timeout: 400 });
    } else {
      window.requestAnimationFrame(resolve);
    }
  });
  const jsenvToolbar = document.createElement("jsenv-toolbar");
  console.debug("toolbar injection: create iframe");
  iframe = createIframeNode();
  const toolbarTriggerNode = createToolbarTriggerNode();
  appendIntoRespectingLineBreaksAndIndentation(iframe, jsenvToolbar, {
    indent: 3,
  });
  appendIntoRespectingLineBreaksAndIndentation(
    toolbarTriggerNode,
    jsenvToolbar,
    {
      indent: 3,
    },
  );
  const iframeLoadedPromise = iframeToLoadedPromise(iframe);
  const toolbarUrlObject = new URL(toolbarUrl, window.location.href);
  toolbarUrlObject.searchParams.set("logLevel", logLevel);
  toolbarUrlObject.searchParams.set("theme", theme);
  if (opened) {
    toolbarUrlObject.searchParams.set("opened", "");
  }
  if (autoreload) {
    toolbarUrlObject.searchParams.set("autoreload", "");
  }
  if (animationsEnabled) {
    toolbarUrlObject.searchParams.set("animationsEnabled", "");
  }
  if (notificationsEnabled) {
    toolbarUrlObject.searchParams.set("notificationsEnabled", "");
  }
  // set iframe src BEFORE putting it into the DOM (prevent firefox adding an history entry)
  iframe.setAttribute("src", toolbarUrlObject.href);
  iframe.name = "jsenv toolbar";

  let timer;
  toolbarTriggerNode.onmouseenter = () => {
    toolbarTriggerNode.setAttribute("data-animate", "");
    timer = setTimeout(expandToolbarTrigger, 500);
  };
  toolbarTriggerNode.onmouseleave = () => {
    clearTimeout(timer);
    collapseToolbarTrigger();
  };
  toolbarTriggerNode.onfocus = () => {
    toolbarTriggerNode.removeAttribute("data-animate");
    expandToolbarTrigger();
  };
  toolbarTriggerNode.onblur = () => {
    toolbarTriggerNode.removeAttribute("data-animate");
    clearTimeout(timer);
    collapseToolbarTrigger();
  };
  toolbarTriggerNode.onclick = () => {
    openToolbar();
  };

  const showToolbarTrigger = () => {
    toolbarTriggerNode.style.display = "block";
  };

  const hideToolbarTrigger = () => {
    toolbarTriggerNode.style.display = "none";
  };

  const expandToolbarTrigger = () => {
    toolbarTriggerNode.setAttribute("data-expanded", "");
  };

  const collapseToolbarTrigger = () => {
    toolbarTriggerNode.removeAttribute("data-expanded", "");
  };

  console.debug("toolbar injection: inject iframe in document");
  const placeholder = getToolbarPlaceholder();
  placeholder.parentNode.replaceChild(jsenvToolbar, placeholder);

  const listenToolbarStateChange = (callback) => {
    return addToolbarEventCallback(iframe, "toolbar_state_change", callback);
  };

  listenToolbarStateChange(({ opened }) => {
    if (opened) {
      hideToolbarTrigger();
    } else {
      showToolbarTrigger();
    }
  });

  const cleanupInitOnReady = addToolbarEventCallback(
    iframe,
    "toolbar_ready",
    () => {
      cleanupInitOnReady();
      sendCommandToToolbar(iframe, "initToolbar");
      setTimeout(() => {
        listenToolbarStateChange(({ animationsEnabled }) => {
          if (animationsEnabled) {
            iframe.style.transitionDuration = "300ms";
          } else {
            iframe.style.transitionDuration = "0s";
          }
        });
      });
    },
  );

  await iframeLoadedPromise;
  console.debug("toolbar injection: iframe loaded");
  resolveToolbarReadyPromise();
  iframe.removeAttribute("tabindex"); // why so late? and not when creating the iframe?

  return iframe;
};

const createIframeNode = () => {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("tabindex", -1);
  iframe.setAttribute("allowtransparency", true);
  // sandbox: "allow-forms allow-modals allow-pointer-lock allow-popups allow-presentation allow-same-origin allow-scripts allow-top-navigation-by-user-activation",
  // allow: "accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; microphone; midi; payment; vr",
  Object.assign(iframe.style, {
    "position": "fixed",
    "zIndex": 1000,
    "bottom": 0,
    "left": 0,
    "width": "100%",
    "height": 0,
    /* ensure toolbar children are not focusable when hidden */
    "visibility": "hidden",
    "transition-duration": "0",
    "transition-property": "height, visibility",
    "border": "none",
  });
  return iframe;
};

const appendIntoRespectingLineBreaksAndIndentation = (
  node,
  parentNode,
  { indent = 2 } = {},
) => {
  const indentMinusOne = "  ".repeat(indent - 1);
  const desiredIndent = "  ".repeat(indent);
  const previousSibling =
    parentNode.childNodes[parentNode.childNodes.length - 1];
  if (previousSibling && previousSibling.nodeName === "#text") {
    if (previousSibling.nodeValue === `\n${indentMinusOne}`) {
      previousSibling.nodeValue = `\n${desiredIndent}`;
    }
    if (previousSibling.nodeValue !== `\n${desiredIndent}`) {
      previousSibling.nodeValue = `\n${desiredIndent}`;
    }
  } else {
    parentNode.appendChild(document.createTextNode(`\n${desiredIndent}`));
  }
  parentNode.appendChild(node);
  parentNode.appendChild(document.createTextNode(`\n${indentMinusOne}`));
};

const createToolbarTriggerNode = () => {
  const css = /* css */ `
    #jsenv_toolbar_trigger {
      position: fixed;
      right: 20px;
      bottom: -32px;
      z-index: 1000;
      display: block;
      width: 40px;
      height: 40px;
      margin: 0;
      padding: 0;
      text-align: center;
      background: transparent;
      border: 1px solid rgba(0, 0, 0, 0.33);
      border-bottom: none;
      border-radius: 5px 5px 0 0;
      box-shadow: 0px 0px 6px 2px rgba(0, 0, 0, 0.46);
      transition: 600ms;
      overflow: hidden;
    }

    #jsenv_toolbar_trigger:hover {
      cursor: pointer;
    }

    #jsenv_toolbar_trigger[data-expanded] {
      bottom: 0;
    }

    #jsenv_toolbar_trigger_icon {
      width: 35px;
      height: 35px;
      opacity: 0;
      transition: 600ms;
    }

    #jsenv_toolbar_trigger[data-expanded] #jsenv_toolbar_trigger_icon {
      opacity: 1;
    }
  `;
  const html = /* html */ ` <div
      id="jsenv_toolbar_trigger"
      style="display:none"
    >
      <style>
        ${css}
      </style>
      <svg id="jsenv_toolbar_trigger_icon">
        <use xlink:href="${jsenvLogoSvgUrl}#jsenv_logo"></use>
      </svg>
    </div>`;

  class JsenvToolbarTriggerHtmlElement extends HTMLElement {
    constructor() {
      super();
      const root = this.attachShadow({ mode: "open" });
      root.innerHTML = html;
    }
  }
  if (customElements && !customElements.get("jsenv-toolbar-trigger")) {
    customElements.define(
      "jsenv-toolbar-trigger",
      JsenvToolbarTriggerHtmlElement,
    );
  }
  const jsenvToolbarTriggerElement = new JsenvToolbarTriggerHtmlElement();
  return jsenvToolbarTriggerElement;
};

const addToolbarEventCallback = (iframe, eventName, callback) => {
  const messageEventCallback = (messageEvent) => {
    const { data } = messageEvent;
    if (typeof data !== "object") {
      return;
    }
    const { __jsenv__ } = data;
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
  iframe.contentWindow.postMessage(
    {
      __jsenv__: {
        command,
        args,
      },
    },
    window.origin,
  );
};

const getToolbarPlaceholder = () => {
  const placeholder = queryPlaceholder();
  if (placeholder) {
    if (document.body.contains(placeholder)) {
      return placeholder;
    }
    // otherwise iframe would not be visible because in <head>
    console.warn(
      "element with [data-jsenv-toolbar-placeholder] must be inside document.body",
    );
    return createTooolbarPlaceholder();
  }
  return createTooolbarPlaceholder();
};

const queryPlaceholder = () => {
  return document.querySelector("[data-jsenv-toolbar-placeholder]");
};

const createTooolbarPlaceholder = () => {
  const jsenvToolbar = document.createElement("jsenv-toolbar");
  appendIntoRespectingLineBreaksAndIndentation(jsenvToolbar, document.body);
  return jsenvToolbar;
};

const iframeToLoadedPromise = (iframe) => {
  return new Promise((resolve) => {
    const onload = () => {
      iframe.removeEventListener("load", onload, true);
      resolve();
    };
    iframe.addEventListener("load", onload, true);
  });
};
