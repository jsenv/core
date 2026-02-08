import { v, m, b } from "../jsenv_plugin_toolbar_node_modules.js";

const paramsFromParentWindow = {};
const searchParams = new URLSearchParams(window.location.search);
searchParams.forEach((value, key) => {
  paramsFromParentWindow[key] = value === "" ? true : value;
});
const parentWindowReloader = window.parent.__reloader__;

const stateFromLocalStorage = localStorage.hasOwnProperty("jsenv_toolbar") ? JSON.parse(localStorage.getItem("jsenv_toolbar")) : {};

const animationsEnabledSignal = v(typeof stateFromLocalStorage.animationsEnabled === "boolean" ? stateFromLocalStorage.animationsEnabled : typeof paramsFromParentWindow.animationsEnabled === "boolean" ? paramsFromParentWindow.animationsEnabled : false);

m(() => {
  const animationsEnabled = animationsEnabledSignal.value;
  if (animationsEnabled) {
    document.documentElement.removeAttribute("data-animation-disabled");
  } else {
    document.documentElement.setAttribute("data-animation-disabled", "");
  }
});

const executionTooltipOpenedSignal = v(false);
const executionSignal = v({
  status: "running"
});
const previousExecutionSignal = v(sessionStorage.hasOwnProperty(window.location.href) ? JSON.parse(sessionStorage.getItem(window.location.href)) : null);
window.parent.__supervisor__.getDocumentExecutionResult().then(({
  status,
  startTime,
  endTime
}) => {
  executionSignal.value = {
    status,
    startTime,
    endTime
  };
});

const notificationAPIDetected = typeof window.Notification === "function";

const notificationsEnabledSignal = v(typeof stateFromLocalStorage.notificationsEnabled === "boolean" ? stateFromLocalStorage.notificationsEnabled : typeof paramsFromParentWindow.notificationsEnabled === "boolean" ? paramsFromParentWindow.notificationsEnabled : false);
const notificationPermissionSignal = v(Notification.permission);

const enableNotifications = () => {
  notificationsEnabledSignal.value = true;
};
const disableNotifications = () => {
  notificationsEnabledSignal.value = false;
};
const arrayOfOpenedNotifications = [];
const notify = notificationAPIDetected ? async (title, {
  clickToFocus = false,
  clickToClose = false,
  ...options
} = {}) => {
  const notificationsEnabled = notificationsEnabledSignal.value;
  if (!notificationsEnabled) {
    return null;
  }
  if (Notification.permission !== "granted") {
    return null;
  }
  const notification = new Notification(title, options);
  arrayOfOpenedNotifications.push(notification);
  notification.onclick = () => {
    // but if the user navigated inbetween
    // focusing window will show something else
    // in that case it could be great to do something
    // maybe like showing a message saying this execution
    // is no longer visible
    // we could also navigauate to this file execution but
    // there is no guarantee re-executing the file would give same output
    // and it would also trigger an other notification
    if (clickToFocus) window.focus();
    if (clickToClose) notification.close();
  };
  notification.onclose = () => {
    const index = arrayOfOpenedNotifications.indexOf(notification);
    if (index > -1) {
      arrayOfOpenedNotifications.splice(index, 1);
    }
  };
  return notification;
} : () => {};
const closeAllNotifications = () => {
  // slice because arrayOfOpenedNotifications can be mutated while looping
  arrayOfOpenedNotifications.slice().forEach(notification => {
    notification.close();
  });
};
let requestPromise;
const requestPermission = notificationAPIDetected ? async () => {
  if (requestPromise) {
    await requestPromise;
    return;
  }
  requestPromise = Notification.requestPermission();
  await requestPromise;
  requestPromise = undefined;
  notificationPermissionSignal.value = Notification.permission;
} : () => Promise.resolve();

const openExecutionTooltip = () => {
  executionTooltipOpenedSignal.value = true;
};
const closeExecutionTooltip = () => {
  executionTooltipOpenedSignal.value = false;
};
const notifyExecutionResult = (execution, previousExecution) => {
  const executedFileRelativeUrl = window.location.href;
  const notificationOptions = {
    lang: "en",
    icon: getFaviconHref(),
    clickToFocus: true,
    clickToClose: true
  };
  if (execution.status === "failed") {
    if (previousExecution) {
      if (previousExecution.status === "completed") {
        notify("Broken", {
          ...notificationOptions,
          body: "".concat(executedFileRelativeUrl, " execution now failing.")
        });
      } else {
        notify("Still failing", {
          ...notificationOptions,
          body: "".concat(executedFileRelativeUrl, " execution still failing.")
        });
      }
    } else {
      notify("Failing", {
        ...notificationOptions,
        body: "".concat(executedFileRelativeUrl, " execution failed.")
      });
    }
  } else if (previousExecution && previousExecution.status === "failed") {
    notify("Fixed", {
      ...notificationOptions,
      body: "".concat(executedFileRelativeUrl, " execution fixed.")
    });
  }
};
const getFaviconHref = () => {
  const link = document.querySelector('link[rel="icon"]');
  return link ? link.href : undefined;
};

m(() => {
  const execution = executionSignal.value;
  if (execution) {
    sessionStorage.setItem(window.location.href, JSON.stringify(execution));
  }
});
m(() => {
  const execution = executionSignal.value;
  const previousExecution = previousExecutionSignal.value;
  if (execution) {
    notifyExecutionResult(execution, previousExecution);
  }
});

m(() => {
  const notificationsEnabled = notificationsEnabledSignal.value;
  if (!notificationsEnabled) {
    closeAllNotifications();
  }
});

const changesTooltipOpenedSignal = v(false);

const openChangesToolip = () => {
  changesTooltipOpenedSignal.value = true;
};
const closeChangesToolip = () => {
  changesTooltipOpenedSignal.value = false;
};

const autoreloadEnabledSignal = v(false);
const reloaderStatusSignal = v("idle");
const changesSignal = v(0);
if (parentWindowReloader) {
  autoreloadEnabledSignal.value = parentWindowReloader.autoreload.enabled;
  parentWindowReloader.autoreload.onchange = () => {
    autoreloadEnabledSignal.value = parentWindowReloader.autoreload.enabled;
  };
  reloaderStatusSignal.value = parentWindowReloader.status.value;
  const onchange = parentWindowReloader.status.onchange;
  parentWindowReloader.status.onchange = () => {
    onchange();
    reloaderStatusSignal.value = parentWindowReloader.status.value;
  };
  changesSignal.value = parentWindowReloader.changes.value;
  parentWindowReloader.changes.onchange = () => {
    changesSignal.value = [...parentWindowReloader.changes.value];
  };
}

const enableVariant = (rootNode, variables) => {
  const nodesNotMatching = Array.from(rootNode.querySelectorAll("[".concat(attributeIndicatingACondition, "]")));
  nodesNotMatching.forEach(nodeNotMatching => {
    const conditionAttributeValue = nodeNotMatching.getAttribute(attributeIndicatingACondition);
    const matches = testCondition(conditionAttributeValue, variables);
    if (matches) {
      renameAttribute(nodeNotMatching, attributeIndicatingACondition, attributeIndicatingAMatch);
    }
  });
  const nodesMatching = Array.from(rootNode.querySelectorAll("[".concat(attributeIndicatingAMatch, "]")));
  nodesMatching.forEach(nodeMatching => {
    const conditionAttributeValue = nodeMatching.getAttribute(attributeIndicatingAMatch);
    const matches = testCondition(conditionAttributeValue, variables);
    if (!matches) {
      renameAttribute(nodeMatching, attributeIndicatingAMatch, attributeIndicatingACondition);
    }
  });
};
const testCondition = (conditionAttributeValue, variables) => {
  const condition = parseCondition(conditionAttributeValue);
  return Object.keys(variables).some(key => {
    if (condition.key !== key) {
      return false;
    }
    // the condition do not specify a value, any value is ok
    if (condition.value === undefined) {
      return true;
    }
    if (condition.value === variables[key]) {
      return true;
    }
    return false;
  });
};
const parseCondition = conditionAttributeValue => {
  const colonIndex = conditionAttributeValue.indexOf(":");
  if (colonIndex === -1) {
    return {
      key: conditionAttributeValue,
      value: undefined
    };
  }
  return {
    key: conditionAttributeValue.slice(0, colonIndex),
    value: conditionAttributeValue.slice(colonIndex + 1)
  };
};
const attributeIndicatingACondition = "data-when";
const attributeIndicatingAMatch = "data-when-active";
const renameAttribute = (node, name, newName) => {
  node.setAttribute(newName, node.getAttribute(name));
  node.removeAttribute(name);
};

const changesIndicator = document.querySelector("#changes_indicator");
const renderChangesIndicator = () => {
  m(() => {
    const autoreloadEnabled = autoreloadEnabledSignal.value;
    const changes = changesSignal.value;
    const changeCount = changes.length;
    enableVariant(changesIndicator, {
      changes: !autoreloadEnabled && changeCount ? "yes" : "no"
    });
    if (changeCount) {
      changesIndicator.querySelector(".tooltip_text").innerHTML = computeTooltipText({
        changes
      });
      changesIndicator.querySelector(".tooltip_text a").onclick = () => {
        // eslint-disable-next-line no-alert
        window.alert(JSON.stringify(changes, null, "  "));
        console.log(changes);
      };
      changesIndicator.querySelector(".changes_text").innerHTML = changeCount;
    }
  });
  changesIndicator.querySelector(".tooltip_action").onclick = () => {
    parentWindowReloader.reload();
  };
  m(() => {
    const changesTooltipOpened = changesTooltipOpenedSignal.value;
    if (changesTooltipOpened) {
      changesIndicator.setAttribute("data-tooltip-visible", "");
    } else {
      changesIndicator.removeAttribute("data-tooltip-visible");
    }
  });
  const button = changesIndicator.querySelector("button");
  button.onclick = () => {
    const changesTooltipOpened = changesTooltipOpenedSignal.value;
    if (changesTooltipOpened) {
      closeChangesToolip();
    } else {
      openChangesToolip();
    }
  };
};
const computeTooltipText = ({
  changes
}) => {
  const changesCount = changes.length;
  if (changesCount === 1) {
    return "There is <a href=\"javascript:void(0)\">1</a> change to apply";
  }
  return "There is  <a href=\"javascript:void(0)\">".concat(changesCount, "<a> changes to apply");
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
const activateToolbarSection = element => {
  element.setAttribute("data-active", "");
};
const deactivateToolbarSection = element => {
  element.removeAttribute("data-active");
};

const executionIndicator = document.querySelector("#document_execution_indicator");
const renderDocumentExecutionIndicator = async () => {
  removeForceHideElement(document.querySelector("#document_execution_indicator"));
  m(() => {
    const execution = executionSignal.value;
    updateExecutionIndicator(execution);
  });
  m(() => {
    const executionTooltipOpened = executionTooltipOpenedSignal.value;
    if (executionTooltipOpened) {
      executionIndicator.setAttribute("data-tooltip-visible", "");
    } else {
      executionIndicator.removeAttribute("data-tooltip-visible");
    }
  });
};
const updateExecutionIndicator = ({
  status,
  startTime,
  endTime
} = {}) => {
  enableVariant(executionIndicator, {
    execution: status
  });
  const variantNode = executionIndicator.querySelector("[data-when-active]");
  variantNode.querySelector("button").onclick = () => {
    const executionTooltipOpened = executionTooltipOpenedSignal.value;
    if (executionTooltipOpened) {
      closeExecutionTooltip();
    } else {
      openExecutionTooltip();
    }
  };
  variantNode.querySelector(".tooltip").textContent = computeText({
    status,
    startTime,
    endTime
  });
};

// relative time: https://github.com/tc39/proposal-intl-relative-time/issues/118
const computeText = ({
  status,
  startTime,
  endTime
}) => {
  if (status === "completed") {
    return "Execution completed in ".concat(endTime - startTime, "ms");
  }
  if (status === "failed") {
    return "Execution failed in ".concat(endTime - startTime, "ms");
  }
  if (status === "running") {
    return "Executing...";
  }
  return "";
};

const setLinkHrefForParentWindow = (a, href) => {
  a.href = href;
  a.onclick = e => {
    if (e.ctrlKey || e.metaKey) {
      return;
    }
    e.preventDefault();
    window.parent.location.href = href;
  };
};

const renderDocumentIndexLink = () => {
  setLinkHrefForParentWindow(document.querySelector("#document_index_link"), "/");
};

const serverTooltipOpenedSignal = v(false);
const serverConnectionSignal = v("default");
const serverEvents$1 = window.__server_events__;
if (serverEvents$1) {
  serverEvents$1.readyState.onchange = () => {
    serverConnectionSignal.value = serverEvents$1.readyState.value;
  };
  serverConnectionSignal.value = serverEvents$1.readyState.value;
}

const openServerTooltip = () => {
  serverTooltipOpenedSignal.value = true;
};
const closeServerTooltip = () => {
  serverTooltipOpenedSignal.value = false;
};

const parentServerEvents = window.parent.__server_events__;
const serverEvents = window.__server_events__;
const serverIndicator = document.querySelector("#server_indicator");
const renderServerIndicator = () => {
  removeForceHideElement(document.querySelector("#server_indicator"));
  m(() => {
    const serverConnection = serverConnectionSignal.value;
    updateServerIndicator(serverConnection);
  });
  m(() => {
    const serverTooltipOpened = serverTooltipOpenedSignal.value;
    if (serverTooltipOpened) {
      serverIndicator.setAttribute("data-tooltip-visible", "");
    } else {
      serverIndicator.removeAttribute("data-tooltip-visible");
    }
  });
};
const updateServerIndicator = connectionState => {
  enableVariant(serverIndicator, {
    connectionState
  });
  const variantNode = document.querySelector("#server_indicator > [data-when-active]");
  variantNode.querySelector("button").onclick = () => {
    const serverTooltipOpened = serverTooltipOpenedSignal.value;
    if (serverTooltipOpened) {
      closeServerTooltip();
    } else {
      openServerTooltip();
    }
  };
  if (connectionState === "connecting") {
    variantNode.querySelector("a").onclick = () => {
      if (parentServerEvents) {
        parentServerEvents.disconnect();
      }
      serverEvents.disconnect();
    };
  } else if (connectionState === "closed") {
    variantNode.querySelector("a").onclick = () => {
      if (parentServerEvents) {
        parentServerEvents.connect();
      }
      serverEvents.connect();
    };
  }
};

const openedSignal = v(typeof stateFromLocalStorage.opened === "boolean" ? stateFromLocalStorage.opened : typeof paramsFromParentWindow.opened === "boolean" ? paramsFromParentWindow.opened : false);

const openToolbar = () => {
  openedSignal.value = true;
};
const closeToolbar = () => {
  openedSignal.value = false;
};

const renderToolbarCloseButton = () => {
  // if user click enter or space quickly while closing toolbar
  // it will cancel the closing
  // that's why I used toggleToolbar and not hideToolbar
  document.querySelector("#toolbar_close_button").onclick = () => {
    if (openedSignal.value) {
      closeToolbar();
    } else {
      openToolbar();
    }
  };
};

const closeAllTooltips = () => {
  closeExecutionTooltip();
  closeServerTooltip();
};

const createHorizontalBreakpoint = breakpointValue => {
  return createBreakpoint(windowWidthMeasure, breakpointValue);
};
const createMeasure = ({
  name,
  compute,
  register
}) => {
  let currentValue = compute();
  const get = () => compute();
  const changed = createSignal();
  let unregister = () => {};
  if (register) {
    unregister = register(() => {
      const value = compute();
      if (value !== currentValue) {
        const previousValue = value;
        currentValue = value;
        changed.notify(value, previousValue);
      }
    });
  }
  return {
    name,
    get,
    changed,
    unregister
  };
};
const createSignal = () => {
  const callbackArray = [];
  const listen = callback => {
    callbackArray.push(callback);
    return () => {
      const index = callbackArray.indexOf(callback);
      if (index > -1) {
        callbackArray.splice(index, 1);
      }
    };
  };
  const notify = (...args) => {
    callbackArray.slice().forEach(callback => {
      callback(...args);
    });
  };
  return {
    listen,
    notify
  };
};
const windowWidthMeasure = createMeasure({
  name: "window-width",
  compute: () => window.innerWidth,
  register: onchange => {
    window.addEventListener("resize", onchange);
    window.addEventListener("orientationchange", onchange);
    return () => {
      window.removeEventListener("resize", onchange);
      window.removeEventListener("orientationchange", onchange);
    };
  }
});
const createBreakpoint = (measure, breakpointValue) => {
  const getBreakpointState = () => {
    const value = measure.get();
    if (value < breakpointValue) {
      return "below";
    }
    if (value > breakpointValue) {
      return "above";
    }
    return "equals";
  };
  let currentBreakpointState = getBreakpointState();
  const isAbove = () => {
    return measure.get() > breakpointValue;
  };
  const isBelow = () => {
    return measure.get() < breakpointValue;
  };
  const breakpointChanged = createSignal();
  measure.changed.listen(() => {
    const breakpointState = getBreakpointState();
    if (breakpointState !== currentBreakpointState) {
      const breakpointStatePrevious = currentBreakpointState;
      currentBreakpointState = breakpointState;
      breakpointChanged.notify(breakpointState, breakpointStatePrevious);
    }
  });
  return {
    isAbove,
    isBelow,
    changed: breakpointChanged
  };
};

// const windowScrollTop = createMeasure({
//   name: "window-scroll-top",
//   compute: () => window.scrollTop,
//   register: (onchange) => {
//     window.addEventListener("scroll", onchange)
//     return () => {
//       window.removeEventListener("scroll", onchange)
//     }
//   },
// })

const WINDOW_SMALL_WIDTH = 420;
const initToolbarMenuOverflow = () => {
  // apply responsive design on toolbar icons if needed + add listener on resize screen
  // ideally we should listen breakpoint once, for now restore toolbar
  const overflowMenuBreakpoint = createHorizontalBreakpoint(WINDOW_SMALL_WIDTH);
  const handleOverflowMenuBreakpoint = () => {
    responsiveToolbar(overflowMenuBreakpoint);
  };
  handleOverflowMenuBreakpoint();
  overflowMenuBreakpoint.changed.listen(handleOverflowMenuBreakpoint);
  document.querySelector("#menu_overflow_button").onclick = () => {
    if (overflowMenuIsOpened()) {
      closeOverflowMenu();
    } else {
      openOverflowMenu();
    }
  };
};
const responsiveToolbar = overflowMenuBreakpoint => {
  // close all tooltips in case opened
  closeAllTooltips();
  // close settings box in case opened
  deactivateToolbarSection(document.querySelector("#settings"));
  if (overflowMenuBreakpoint.isBelow()) {
    enableOverflow();
  } else {
    disableOverflow();
  }
};
let moves = [];
const enableOverflow = () => {
  // move elements from toolbar to overflow menu
  const responsiveToolbarElements = document.querySelectorAll("[data-responsive-toolbar-element]");
  const overflowMenu = document.querySelector("#menu_overflow");

  // keep a placeholder element to know where to move them back
  moves = Array.from(responsiveToolbarElements).map(element => {
    const placeholder = document.createElement("div");
    placeholder.style.display = "none";
    placeholder.setAttribute("data-placeholder", "");
    element.parentNode.replaceChild(placeholder, element);
    overflowMenu.appendChild(element);
    return {
      element,
      placeholder
    };
  });
  document.querySelector("#toolbar").setAttribute("data-menu-overflow-enabled", "");
  removeForceHideElement(document.querySelector("#menu_overflow_button"));
};
const disableOverflow = () => {
  // close overflow menu in case it's open & unselect toggleOverflowMenu button in case it's selected
  closeOverflowMenu();
  deactivateToolbarSection(document.querySelector("#menu_overflow"));
  moves.forEach(({
    element,
    placeholder
  }) => {
    placeholder.parentNode.replaceChild(element, placeholder);
  });
  moves = [];
  document.querySelector("#toolbar").removeAttribute("data-menu-overflow-enabled");
  forceHideElement(document.querySelector("#menu_overflow_button"));
};
const overflowMenuIsOpened = () => {
  const toolbar = document.querySelector("#toolbar");
  return toolbar.hasAttribute("data-menu-overflow-opened");
};
const openOverflowMenu = () => {
  const toolbar = document.querySelector("#toolbar");
  document.querySelector("#menu_overflow").setAttribute("data-animate", "");
  toolbar.setAttribute("data-menu-overflow-opened", "");
};
const closeOverflowMenu = () => {
  const toolbar = document.querySelector("#toolbar");
  toolbar.removeAttribute("data-menu-overflow-opened");
  document.querySelector("#menu_overflow").removeAttribute("data-animate");
};

const startJavaScriptAnimation = ({
  duration = 300,
  timingFunction = t => t,
  onProgress = () => {},
  onCancel = () => {},
  onComplete = () => {}
}) => {
  if (isNaN(duration)) {
    // console.warn(`duration must be a number, received ${duration}`)
    return () => {};
  }
  duration = parseInt(duration, 10);
  const startMs = performance.now();
  let currentRequestAnimationFrameId;
  let done = false;
  let rawProgress = 0;
  let progress = 0;
  const handler = () => {
    currentRequestAnimationFrameId = null;
    const nowMs = performance.now();
    rawProgress = Math.min((nowMs - startMs) / duration, 1);
    progress = timingFunction(rawProgress);
    done = rawProgress === 1;
    onProgress({
      done,
      rawProgress,
      progress
    });
    if (done) {
      onComplete();
    } else {
      currentRequestAnimationFrameId = window.requestAnimationFrame(handler);
    }
  };
  handler();
  const stop = () => {
    if (currentRequestAnimationFrameId) {
      window.cancelAnimationFrame(currentRequestAnimationFrameId);
      currentRequestAnimationFrameId = null;
    }
    if (!done) {
      done = true;
      onCancel({
        rawProgress,
        progress
      });
    }
  };
  return stop;
};

const initToolbarOpening = () => {
  m(() => {
    const opened = openedSignal.value;
    if (opened) {
      showToolbar();
    } else {
      hideToolbar();
    }
  });
};
let restoreToolbarIframeParentStyles = () => {};
let restoreToolbarIframeStyles = () => {};
const hideToolbar = () => {
  closeAllTooltips();
  restoreToolbarIframeParentStyles();
  restoreToolbarIframeStyles();
  document.documentElement.removeAttribute("data-toolbar-visible");
};

// (by the way it might be cool to have the toolbar auto show when)
// it has something to say (being disconnected from server)
const showToolbar = () => {
  const animationsEnabled = animationsEnabledSignal.peek();
  document.documentElement.setAttribute("data-toolbar-visible", "");
  const toolbarIframe = getToolbarIframe();
  const toolbarIframeParent = toolbarIframe.parentNode;
  const parentWindow = window.parent;
  const parentDocumentElement = parentWindow.document.compatMode === "CSS1Compat" ? parentWindow.document.documentElement : parentWindow.document.body;
  const scrollYMax = parentDocumentElement.scrollHeight - parentWindow.innerHeight;
  const scrollY = parentDocumentElement.scrollTop;
  const scrollYRemaining = scrollYMax - scrollY;
  setStyles(toolbarIframeParent, {
    "transition-property": "padding-bottom",
    "transition-duration": animationsEnabled ? "300ms" : "0s"
  });
  // maybe we should use js animation here because we would not conflict with css
  restoreToolbarIframeParentStyles = setStyles(toolbarIframeParent, {
    "scroll-padding-bottom": "40px",
    // same here we should add 40px
    "padding-bottom": "40px" // if there is already one we should add 40px
  });
  restoreToolbarIframeStyles = setStyles(toolbarIframe, {
    height: "40px",
    visibility: "visible"
  });
  if (scrollYRemaining < 40 && scrollYMax > 0) {
    const scrollEnd = scrollY + 40;
    startJavaScriptAnimation({
      duration: 300,
      onProgress: ({
        progress
      }) => {
        const value = scrollY + (scrollEnd - scrollY) * progress;
        parentDocumentElement.scrollTop = value;
      }
    });
  }
};

const settingsOpenedSignal = v(false);

const openSettings = () => {
  settingsOpenedSignal.value = true;
};
const closeSettings = () => {
  settingsOpenedSignal.value = false;
};

const renderToolbarOverlay = () => {
  const toolbarOverlay = document.querySelector("#toolbar_overlay");
  toolbarOverlay.onclick = () => {
    closeAllTooltips();
    closeSettings();
  };
  m(() => {
    if (!window.parent) {
      // can happen while parent iframe reloads
      return;
    }
    const opened = openedSignal.value;
    const settingsOpened = settingsOpenedSignal.value;
    const executionTooltipOpened = executionTooltipOpenedSignal.value;
    const changesTooltipOpened = changesTooltipOpenedSignal.value;
    const serverTooltipOpened = serverTooltipOpenedSignal.value;
    if (!opened) {
      return;
    }
    if (settingsOpened || executionTooltipOpened || changesTooltipOpened || serverTooltipOpened) {
      enableIframeOverflowOnParentWindow();
    } else {
      disableIframeOverflowOnParentWindow();
    }
  });
};
const enableIframeOverflowOnParentWindow = () => {
  const iframe = getToolbarIframe();
  const transitionDuration = iframe.style.transitionDuration;
  setStyles(iframe, {
    "height": "100%",
    // we don't want to animate height transition
    // but if it was enabled, we'll restore it afterwards
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
  const iframe = getToolbarIframe();
  const transitionDuration = iframe.style.transitionDuration;
  setStyles(iframe, {
    "height": "40px",
    // we don't want to animate height transition
    // but if it was enabled, we'll restore it afterwards
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

const enableAnimations = () => {
  animationsEnabledSignal.value = true;
};
const disableAnimations = () => {
  animationsEnabledSignal.value = false;
};

const renderToolbarAnimationSetting = () => {
  const animCheckbox = document.querySelector("#toggle_anims");
  m(() => {
    const animationsEnabled = animationsEnabledSignal.value;
    animCheckbox.checked = animationsEnabled;
  });
  animCheckbox.onchange = () => {
    if (animCheckbox.checked) {
      enableAnimations();
    } else {
      disableAnimations();
    }
  };
  // enable toolbar transition only after first render
  setTimeout(() => {
    document.querySelector("#toolbar").setAttribute("data-animate", "");
  });
};

const sendEventToParent = (name, data) => {
  window.parent.postMessage({
    __jsenv__: {
      event: name,
      data
    }
  }, "*");
};
const addExternalCommandCallback = (command, callback) => {
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
    if (__jsenv__.command !== command) {
      return;
    }
    callback(...__jsenv__.args);
  };
  window.addEventListener("message", messageEventCallback);
  return () => {
    window.removeEventListener("message", messageEventCallback);
  };
};
const enableAutoreload = () => {
  parentWindowReloader.autoreload.enable();
};
const disableAutoreload = () => {
  parentWindowReloader.autoreload.disable();
};

const renderToolbarAutoreloadSetting = () => {
  const parentWindowReloader = window.parent.__reloader__;
  if (!parentWindowReloader) {
    disableAutoreloadSetting();
    return;
  }
  const autoreloadCheckbox = document.querySelector("#toggle_autoreload");
  m(() => {
    const autoreloadEnabled = autoreloadEnabledSignal.value;
    if (autoreloadEnabled) {
      autoreloadCheckbox.checked = true;
    } else {
      autoreloadCheckbox.checked = false;
    }
  });
  autoreloadCheckbox.onchange = () => {
    if (autoreloadCheckbox.checked) {
      enableAutoreload();
    } else {
      disableAutoreload();
    }
  };
};
const disableAutoreloadSetting = () => {
  document.querySelector(".settings_autoreload").setAttribute("data-disabled", "true");
  document.querySelector(".settings_autoreload").setAttribute("title", "Autoreload not enabled on server");
  document.querySelector("#toggle_autoreload").disabled = true;
};

// const changeLink = variantNode.querySelector(".eventsource-changes-link")
// changeLink.innerHTML = reloadMessageCount
// changeLink.onclick = () => {
//   console.log(reloadMessages)
//   // eslint-disable-next-line no-alert
//   window.parent.alert(JSON.stringify(reloadMessages, null, "  "))
// }

// const someFailed = reloadMessages.some((m) => m.status === "failed")
// const somePending = reloadMessages.some((m) => m.status === "pending")
// const applyLink = variantNode.querySelector(".eventsource-reload-link")
// applyLink.innerHTML = someFailed
//   ? "failed"
//   : somePending
//   ? "applying..."
//   : "apply changes"
// applyLink.onclick = someFailed
//   ? () => {
//       parentEventSourceClient.applyReloadMessageEffects()
//     }
//   : somePending
//   ? () => {}
//   : () => {
//       parentEventSourceClient.applyReloadMessageEffects()
//     }

// parentEventSourceClient.reloadMessagesSignal.onchange = () => {
//   updateEventSourceIndicator()
// }
// const autoreloadCheckbox = document.querySelector("#toggle-autoreload")
// autoreloadCheckbox.checked = parentEventSourceClient.isAutoreloadEnabled()
// autoreloadCheckbox.onchange = () => {
//   parentEventSourceClient.setAutoreloadPreference(autoreloadCheckbox.checked)
//   updateEventSourceIndicator()
// }

const notifCheckbox = document.querySelector("#toggle_notifs");
const renderToolbarNotificationSetting = () => {
  m(() => {
    const notificationsEnabled = notificationsEnabledSignal.value;
    notifCheckbox.checked = notificationsEnabled;
  });
  m(() => {
    const notificationPermission = notificationPermissionSignal.value;
    if (!notificationAPIDetected) {
      applyNotificationNotAvailableEffects();
      return;
    }
    if (notificationPermission === "default") {
      applyNotificationDefaultEffects();
      return;
    }
    if (notificationPermission === "denied") {
      applyNotificationDeniedEffects();
      return;
    }
    if (notificationPermission === "granted") {
      applyNotificationGrantedEffects();
      return;
    }
  });
};
const applyNotificationNotAvailableEffects = () => {
  const notifSetting = document.querySelector(".settings_notification");
  notifSetting.setAttribute("data-disabled", "true");
  notifSetting.setAttribute("title", "Notification not available in the browser");
  notifCheckbox.disabled = true;
};
const applyNotificationDefaultEffects = () => {
  applyNotificationNOTGrantedEffects();
  const notifSetting = document.querySelector(".settings_notification");
  notifSetting.removeAttribute("data-disabled");
  notifSetting.removeAttribute("title");
};
const applyNotificationDeniedEffects = () => {
  applyNotificationNOTGrantedEffects();
  const notifSetting = document.querySelector(".settings_notification");
  notifSetting.setAttribute("data-disabled", "true");
  notifSetting.setAttribute("title", "Notification denied");
};
const applyNotificationGrantedEffects = () => {
  enableVariant(document.querySelector(".notification_text"), {
    notif_granted: "yes"
  });
  notifCheckbox.disabled = false;
  notifCheckbox.onchange = () => {
    if (notifCheckbox.checked) {
      enableNotifications();
    } else {
      disableNotifications();
    }
  };
};
const applyNotificationNOTGrantedEffects = () => {
  enableVariant(document.querySelector(".notification_text"), {
    notif_granted: "no"
  });
  notifCheckbox.disabled = true;
  notifCheckbox.checked = false;
  document.querySelector("a.request_notification_permission").onclick = () => {
    requestPermission();
  };
};

const ribbonDisplayedSignal = v(typeof stateFromLocalStorage.ribbonDisplayed === "boolean" ? stateFromLocalStorage.ribbonDisplayed : true);

const ribbonBox = document.querySelector("#ribbon_box");
const ribbonCheckbox = ribbonBox.querySelector("input");
const renderToolbarRibbonSetting = () => {
  const ribbonContainer = window.parent.document.querySelector("#jsenv_ribbon_container");
  if (ribbonContainer) {
    ribbonBox.style.display = "block";
    m(() => {
      const ribbonDisplayed = ribbonDisplayedSignal.value;
      ribbonCheckbox.checked = ribbonDisplayed;
      if (ribbonDisplayed) {
        ribbonContainer.style.display = "block";
      } else {
        ribbonContainer.style.display = "none";
      }
    });
    ribbonCheckbox.onchange = () => {
      if (ribbonCheckbox.checked) {
        ribbonDisplayedSignal.value = true;
      } else {
        ribbonDisplayedSignal.value = false;
      }
    };
  }
};

const themeSignal = v(typeof stateFromLocalStorage.theme === "string" ? stateFromLocalStorage.theme : typeof paramsFromParentWindow.theme === "string" ? paramsFromParentWindow.theme : "dark");

const switchToLightTheme = () => {
  themeSignal.value = "light";
};
const switchToDefaultTheme = () => {
  themeSignal.value = "dark";
};

const renderToolbarThemeSetting = () => {
  const checkbox = document.querySelector("#checkbox_dark_theme");
  checkbox.checked = themeSignal.value === "dark";
  checkbox.onchange = () => {
    if (checkbox.checked) {
      switchToDefaultTheme();
    } else {
      switchToLightTheme();
    }
  };
};

const renderToolbarSettings = () => {
  document.querySelector("#settings_open_button").onclick = toggleSettings;
  document.querySelector("#settings_close_button").onclick = toggleSettings;
  disableWarningStyle();
  renderToolbarAutoreloadSetting();
  renderToolbarAnimationSetting();
  renderToolbarNotificationSetting();
  renderToolbarThemeSetting();
  renderToolbarRibbonSetting();
  m(() => {
    const settingsOpened = settingsOpenedSignal.value;
    if (settingsOpened) {
      activateToolbarSection(document.querySelector("#settings"));
    } else {
      deactivateToolbarSection(document.querySelector("#settings"));
    }
  });
};
const toggleSettings = () => {
  const settingsOpened = settingsOpenedSignal.value;
  if (settingsOpened) {
    closeSettings();
  } else {
    openSettings();
  }
};
const disableWarningStyle = () => {
  enableVariant(document.querySelector("#settings_open_button"), {
    has_warning: "no"
  });
};

const initToolbarUI = () => {
  initToolbarOpening();
  initToolbarMenuOverflow();
  renderToolbarOverlay();
  renderDocumentIndexLink();
  renderDocumentExecutionIndicator();
  renderChangesIndicator();
  renderServerIndicator();
  renderToolbarSettings();
  renderToolbarCloseButton();
};

addExternalCommandCallback("initToolbar", () => {
  // for the first render, force disable animations
  const animationsEnabled = animationsEnabledSignal.value;
  if (animationsEnabled) {
    animationsEnabledSignal.value = false;
  }
  initToolbarUI();
  if (animationsEnabled) {
    animationsEnabledSignal.value = true;
  }
});
sendEventToParent("toolbar_ready");

m(() => {
  const serverConnection = serverConnectionSignal.value;
  if (serverConnection === "connecting" || serverConnection === "closed") {
    openServerTooltip();
  }
});

m(() => {
  const theme = themeSignal.value;
  document.querySelector("html").setAttribute("data-theme", theme);
});

addExternalCommandCallback("openToolbar", openToolbar);
addExternalCommandCallback("closeToolbar", closeToolbar);

const toolbarStateSignal = b(() => {
  const opened = openedSignal.value;
  const theme = themeSignal.value;
  const animationsEnabled = animationsEnabledSignal.value;
  const notificationsEnabled = notificationsEnabledSignal.value;
  const ribbonDisplayed = ribbonDisplayedSignal.value;
  return {
    opened,
    theme,
    animationsEnabled,
    notificationsEnabled,
    ribbonDisplayed
  };
});

m(() => {
  const toolbarState = toolbarStateSignal.value;
  localStorage.setItem("jsenv_toolbar", JSON.stringify(toolbarState));
  sendEventToParent("toolbar_state_change", toolbarState);
});
