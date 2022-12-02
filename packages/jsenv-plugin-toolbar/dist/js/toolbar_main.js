import { u as updateIframeOverflowOnParentWindow, t as toolbarSectionIsActive, d as deactivateToolbarSection, a as activateToolbarSection, r as removeForceHideElement, f as forceHideElement, g as getToolbarIframe, s as setStyles } from "./toolbar_injector.js";

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

// handle data-last-interaction attr on html (focusring)
window.addEventListener("mousedown", mousedownEvent => {
  if (mousedownEvent.defaultPrevented) {
    return;
  }
  document.documentElement.setAttribute("data-last-interaction", "mouse");
});
window.addEventListener("touchstart", touchstartEvent => {
  if (touchstartEvent.defaultPrevented) {
    return;
  }
  document.documentElement.setAttribute("data-last-interaction", "mouse");
});
window.addEventListener("keydown", keydownEvent => {
  if (keydownEvent.defaultPrevented) {
    return;
  }
  document.documentElement.setAttribute("data-last-interaction", "keyboard");
});

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

const createPreference = name => {
  return {
    has: () => localStorage.hasOwnProperty(name),
    get: () => localStorage.hasOwnProperty(name) ? JSON.parse(localStorage.getItem(name)) : undefined,
    set: value => localStorage.setItem(name, JSON.stringify(value))
  };
};

const toggleTooltip = element => {
  if (element.hasAttribute("data-tooltip-visible")) {
    hideTooltip(element);
  } else {
    showTooltip(element);
  }
};
const hideTooltip = element => {
  element.removeAttribute("data-tooltip-visible");
  element.removeAttribute("data-tooltip-auto-visible");
  updateIframeOverflowOnParentWindow();
};
const showTooltip = element => {
  element.setAttribute("data-tooltip-visible", "");
  updateIframeOverflowOnParentWindow();
};
const autoShowTooltip = element => {
  element.setAttribute("data-tooltip-auto-visible", "");
  updateIframeOverflowOnParentWindow();
};
const removeAutoShowTooltip = element => {
  element.removeAttribute("data-tooltip-auto-visible");
  updateIframeOverflowOnParentWindow();
};
const hideAllTooltip = () => {
  const elementsWithTooltip = Array.from(document.querySelectorAll("[data-tooltip-visible]"));
  elementsWithTooltip.forEach(elementWithTooltip => {
    hideTooltip(elementWithTooltip);
  });
};

const enableVariant = (rootNode, variables) => {
  const nodesNotMatching = Array.from(rootNode.querySelectorAll(`[${attributeIndicatingACondition}]`));
  nodesNotMatching.forEach(nodeNotMatching => {
    const conditionAttributeValue = nodeNotMatching.getAttribute(attributeIndicatingACondition);
    const matches = testCondition(conditionAttributeValue, variables);
    if (matches) {
      renameAttribute(nodeNotMatching, attributeIndicatingACondition, attributeIndicatingAMatch);
    }
  });
  const nodesMatching = Array.from(rootNode.querySelectorAll(`[${attributeIndicatingAMatch}]`));
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
const attributeIndicatingACondition = `data-when`;
const attributeIndicatingAMatch = `data-when-active`;
const renameAttribute = (node, name, newName) => {
  node.setAttribute(newName, node.getAttribute(name));
  node.removeAttribute(name);
};

const renderToolbarSettings = () => {
  document.querySelector("#settings-button").onclick = toggleSettings;
  document.querySelector("#button-close-settings").onclick = toggleSettings;
  disableWarningStyle();
};
const toggleSettings = () => {
  if (settingsAreVisible()) {
    hideSettings();
  } else {
    showSettings();
  }
};
const disableWarningStyle = () => {
  enableVariant(document.querySelector("#settings-button"), {
    has_warning: "no"
  });
};
const settingsAreVisible = () => {
  return toolbarSectionIsActive(document.querySelector(`#settings`));
};
const hideSettings = () => {
  deactivateToolbarSection(document.querySelector(`#settings`));
  updateIframeOverflowOnParentWindow();
};
const showSettings = () => {
  activateToolbarSection(document.querySelector(`#settings`));
  updateIframeOverflowOnParentWindow();
};

const notificationAvailable = typeof window.Notification === "function";
const notificationPreference = createPreference("notification");
const arrayOfOpenedNotifications = [];
const renderToolbarNotification = () => {
  if (!notificationAvailable) {
    applyNotificationNotAvailableEffects();
    return;
  }
  updatePermission();
};
const updatePermission = () => {
  const notifPermission = Notification.permission;
  if (notifPermission === "default") {
    applyNotificationDefaultEffects();
    return;
  }
  if (notifPermission === "denied") {
    applyNotificationDeniedEffects();
    return;
  }
  if (notifPermission === "granted") {
    applyNotificationGrantedEffects();
    return;
  }
};
const notifCheckbox = document.querySelector("#toggle-notifs");
const applyNotificationNotAvailableEffects = () => {
  const notifSetting = document.querySelector(".settings-notification");
  notifSetting.setAttribute("data-disabled", "true");
  notifSetting.setAttribute("title", `Notification not available in the browser`);
  notifCheckbox.disabled = true;
};
const applyNotificationDefaultEffects = () => {
  applyNotificationNOTGrantedEffects();
  const notifSetting = document.querySelector(".settings-notification");
  notifSetting.removeAttribute("data-disabled");
  notifSetting.removeAttribute("title");
};
const applyNotificationDeniedEffects = () => {
  applyNotificationNOTGrantedEffects();
  const notifSetting = document.querySelector(".settings-notification");
  notifSetting.setAttribute("data-disabled", "true");
  notifSetting.setAttribute("title", `Notification denied`);
};
const applyNotificationGrantedEffects = () => {
  enableVariant(document.querySelector(".notification-text"), {
    notif_granted: "yes"
  });
  notifCheckbox.disabled = false;
  notifCheckbox.checked = getNotificationPreference();
  notifCheckbox.onchange = () => {
    setNotificationPreference(notifCheckbox.checked);
    if (!notifCheckbox.checked) {
      // slice because arrayOfOpenedNotifications can be mutated while looping
      arrayOfOpenedNotifications.slice().forEach(notification => {
        notification.close();
      });
    }
  };
};
const applyNotificationNOTGrantedEffects = () => {
  enableVariant(document.querySelector(".notification-text"), {
    notif_granted: "no"
  });
  notifCheckbox.disabled = true;
  notifCheckbox.checked = false;
  document.querySelector("a.request_notification_permission").onclick = () => {
    requestPermission().then(() => {
      setNotificationPreference(true);
      updatePermission();
    });
  };
};
const notifyExecutionResult = (executedFileRelativeUrl, execution, previousExecution) => {
  const notificationEnabled = getNotificationPreference();
  if (!notificationEnabled) return;
  const notificationOptions = {
    lang: "en",
    icon: getFaviconHref(),
    clickToFocus: true,
    clickToClose: true
  };
  if (execution.status === "errored") {
    if (previousExecution) {
      if (previousExecution.status === "completed") {
        notify("Broken", {
          ...notificationOptions,
          body: `${executedFileRelativeUrl} execution now failing.`
        });
      } else {
        notify("Still failing", {
          ...notificationOptions,
          body: `${executedFileRelativeUrl} execution still failing.`
        });
      }
    } else {
      notify("Failing", {
        ...notificationOptions,
        body: `${executedFileRelativeUrl} execution failed.`
      });
    }
  } else if (previousExecution && previousExecution.status === "errored") {
    notify("Fixed", {
      ...notificationOptions,
      body: `${executedFileRelativeUrl} execution fixed.`
    });
  }
};
const getNotificationPreference = () => notificationPreference.has() ? notificationPreference.get() : true;
const setNotificationPreference = value => notificationPreference.set(value);
const getFaviconHref = () => {
  const link = document.querySelector('link[rel="icon"]');
  return link ? link.href : undefined;
};
let permission = "default";
const notify = notificationAvailable ? async (title, {
  clickToFocus = false,
  clickToClose = false,
  ...options
} = {}) => {
  if (permission !== "granted") {
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
let requestPromise;
const requestPermission = notificationAvailable ? async () => {
  if (requestPromise) return requestPromise;
  requestPromise = Notification.requestPermission();
  permission = await requestPromise;
  requestPromise = undefined;
  return permission;
} : () => Promise.resolve("default");

const DARK_THEME = "dark";
const LIGHT_THEME = "light";
const themePreference = createPreference("theme");
const renderToolbarTheme = () => {
  const theme = getThemePreference();
  const checkbox = document.querySelector("#checkbox-dark-theme");
  checkbox.checked = theme === DARK_THEME;
  setTheme(theme);
  checkbox.onchange = () => {
    if (checkbox.checked) {
      setThemePreference(DARK_THEME);
      setTheme(DARK_THEME);
    } else {
      setThemePreference(LIGHT_THEME);
      setTheme(LIGHT_THEME);
    }
  };
};
const getThemePreference = () => {
  return themePreference.has() ? themePreference.get() : DARK_THEME;
};
const setThemePreference = value => {
  themePreference.set(value);
  setTheme(value);
};
const setTheme = theme => {
  document.querySelector("html").setAttribute("data-theme", theme);
};

const animationPreference = createPreference("animation");
const renderToolbarAnimation = () => {
  const animCheckbox = document.querySelector("#toggle-anims");
  animCheckbox.checked = getAnimationPreference();
  animCheckbox.onchange = () => {
    setAnimationPreference(animCheckbox.checked);
    onPreferenceChange(animCheckbox.checked);
  };
  onPreferenceChange();

  // enable toolbar transition only after first render
  setTimeout(() => {
    document.querySelector("#toolbar").setAttribute("data-animate", "");
  });
};
const onPreferenceChange = (value = getAnimationPreference()) => {
  if (value) {
    enableAnimation();
  } else {
    disableAnimation();
  }
};
const getAnimationPreference = () => animationPreference.has() ? animationPreference.get() : true;
const setAnimationPreference = value => animationPreference.set(value);
const enableAnimation = () => {
  document.documentElement.removeAttribute("data-animation-disabled");
};
const disableAnimation = () => {
  document.documentElement.setAttribute("data-animation-disabled", "");
};

const renderExecutionInToolbar = async () => {
  // reset file execution indicator ui
  applyExecutionIndicator();
  removeForceHideElement(document.querySelector("#execution-indicator"));
  const {
    status,
    startTime,
    endTime
  } = await window.parent.__supervisor__.getDocumentExecutionResult();
  const execution = {
    status,
    startTime,
    endTime
  };
  applyExecutionIndicator(execution);
  const executionStorageKey = window.location.href;
  const previousExecution = sessionStorage.hasOwnProperty(executionStorageKey) ? JSON.parse(sessionStorage.getItem(executionStorageKey)) : undefined;
  notifyExecutionResult(executionStorageKey, execution, previousExecution);
  sessionStorage.setItem(executionStorageKey, JSON.stringify(execution));
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

const applyExecutionIndicator = ({
  status = "running",
  startTime,
  endTime
} = {}) => {
  const executionIndicator = document.querySelector("#execution-indicator");
  enableVariant(executionIndicator, {
    execution: status
  });
  const variantNode = executionIndicator.querySelector("[data-when-active]");
  variantNode.querySelector("button").onclick = () => toggleTooltip(executionIndicator);
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
    return `Execution completed in ${endTime - startTime}ms`;
  }
  if (status === "errored") {
    return `Execution failed in ${endTime - startTime}ms`;
  }
  if (status === "running") {
    return "Executing...";
  }
  return "";
};

const parentEventSourceClient = window.parent.__jsenv_event_source_client__;
const initToolbarEventSource = () => {
  removeForceHideElement(document.querySelector("#eventsource-indicator"));
  if (!parentEventSourceClient) {
    disableAutoreloadSetting();
    return;
  }
  parentEventSourceClient.status.onchange = () => {
    updateEventSourceIndicator();
  };
  updateEventSourceIndicator();
};
const updateEventSourceIndicator = () => {
  const eventSourceIndicator = document.querySelector("#eventsource-indicator");
  const eventSourceConnectionState = parentEventSourceClient.status.value;
  enableVariant(eventSourceIndicator, {
    eventsource: eventSourceConnectionState
  });
  const variantNode = document.querySelector("#eventsource-indicator > [data-when-active]");
  variantNode.querySelector("button").onclick = () => {
    toggleTooltip(eventSourceIndicator);
  };
  if (eventSourceConnectionState === "connecting") {
    variantNode.querySelector("a").onclick = () => {
      parentEventSourceClient.disconnect();
    };
  } else if (eventSourceConnectionState === "connected") {
    removeAutoShowTooltip(eventSourceIndicator);
  } else if (eventSourceConnectionState === "disconnected") {
    autoShowTooltip(eventSourceIndicator);
    variantNode.querySelector("a").onclick = () => {
      parentEventSourceClient.connect();
    };
  }
};
const disableAutoreloadSetting = () => {
  document.querySelector(".settings-autoreload").setAttribute("data-disabled", "true");
  document.querySelector(".settings-autoreload").setAttribute("title", `Autoreload not available: disabled by server`);
  document.querySelector("#toggle-autoreload").disabled = true;
};

const createHorizontalBreakpoint = breakpointValue => {
  return createBreakpoint(windowWidthMeasure, breakpointValue);
};
const createMeasure = ({
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
const makeToolbarResponsive = () => {
  // apply responsive design on toolbar icons if needed + add listener on resize screen
  // ideally we should listen breakpoint once, for now restore toolbar
  const overflowMenuBreakpoint = createHorizontalBreakpoint(WINDOW_SMALL_WIDTH);
  const handleOverflowMenuBreakpoint = () => {
    responsiveToolbar(overflowMenuBreakpoint);
  };
  handleOverflowMenuBreakpoint();
  overflowMenuBreakpoint.changed.listen(handleOverflowMenuBreakpoint);

  // overflow menu
  document.querySelector("#overflow-menu-button").onclick = () => toggleOverflowMenu();
};
const responsiveToolbar = overflowMenuBreakpoint => {
  // close all tooltips in case opened
  hideTooltip(document.querySelector("#eventsource-indicator"));
  hideTooltip(document.querySelector("#execution-indicator"));
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
  const overflowMenu = document.querySelector("#overflow-menu");

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
  document.querySelector("#toolbar").setAttribute("data-overflow-menu-enabled", "");
  removeForceHideElement(document.querySelector("#overflow-menu-button"));
};
const disableOverflow = () => {
  // close overflow menu in case it's open & unselect toggleOverflowMenu button in case it's selected
  hideOverflowMenu();
  deactivateToolbarSection(document.querySelector("#overflow-menu"));
  moves.forEach(({
    element,
    placeholder
  }) => {
    placeholder.parentNode.replaceChild(element, placeholder);
  });
  moves = [];
  document.querySelector("#toolbar").removeAttribute("data-overflow-menu-enabled");
  forceHideElement(document.querySelector("#overflow-menu-button"));
};
const toggleOverflowMenu = () => {
  if (overflowMenuIsVisible()) {
    hideOverflowMenu();
  } else {
    showOverflowMenu();
  }
};
const overflowMenuIsVisible = () => {
  const toolbar = document.querySelector("#toolbar");
  return toolbar.hasAttribute("data-overflow-menu-visible");
};
const showOverflowMenu = () => {
  const toolbar = document.querySelector("#toolbar");
  document.querySelector("#overflow-menu").setAttribute("data-animate", "");
  toolbar.setAttribute("data-overflow-menu-visible", "");
};
const hideOverflowMenu = () => {
  const toolbar = document.querySelector("#toolbar");
  toolbar.removeAttribute("data-overflow-menu-visible");
  document.querySelector("#overflow-menu").removeAttribute("data-animate");
};

const toolbarVisibilityPreference = createPreference("toolbar");
const renderToolbar = async () => {
  const toolbarOverlay = document.querySelector("#toolbar-overlay");
  toolbarOverlay.onclick = () => {
    hideAllTooltip();
    hideSettings();
  };
  const toolbarVisible = toolbarVisibilityPreference.has() ? toolbarVisibilityPreference.get() : true;
  if (toolbarVisible) {
    showToolbar({
      animate: false
    });
  } else {
    hideToolbar({
      animate: false
    });
  }
  setLinkHrefForParentWindow(document.querySelector(".toolbar-icon-wrapper"), "/");
  renderToolbarNotification();
  makeToolbarResponsive();
  renderToolbarSettings();
  renderToolbarAnimation();
  renderToolbarTheme();
  renderExecutionInToolbar();
  // this might become active but we need to detect this somehow
  deactivateToolbarSection(document.querySelector("#file-list-link"));
  initToolbarEventSource();

  // if user click enter or space quickly while closing toolbar
  // it will cancel the closing
  // that's why I used toggleToolbar and not hideToolbar
  document.querySelector("#button-close-toolbar").onclick = () => toogleToolbar();
};
const toogleToolbar = () => {
  if (toolbarIsVisible()) {
    hideToolbar();
  } else {
    showToolbar();
  }
};
const toolbarIsVisible = () => document.documentElement.hasAttribute("data-toolbar-visible");
let hideToolbar = () => {
  // toolbar hidden by default, nothing to do to hide it by default
  sendEventToParent("toolbar-visibility-change", false);
};

// (by the way it might be cool to have the toolbar auto show when)
// it has something to say (being disconnected from server)
const showToolbar = ({
  animate = true
} = {}) => {
  toolbarVisibilityPreference.set(true);
  if (animate) {
    document.documentElement.setAttribute("data-toolbar-animation", "");
  } else {
    document.documentElement.removeAttribute("data-toolbar-animation");
  }
  document.documentElement.setAttribute("data-toolbar-visible", "");
  sendEventToParent("toolbar-visibility-change", true);
  const toolbarIframe = getToolbarIframe();
  const toolbarIframeParent = toolbarIframe.parentNode;
  const parentWindow = window.parent;
  const parentDocumentElement = parentWindow.document.compatMode === "CSS1Compat" ? parentWindow.document.documentElement : parentWindow.document.body;
  const scrollYMax = parentDocumentElement.scrollHeight - parentWindow.innerHeight;
  const scrollY = parentDocumentElement.scrollTop;
  const scrollYRemaining = scrollYMax - scrollY;
  setStyles(toolbarIframeParent, {
    "transition-property": "padding-bottom",
    "transition-duration": "300ms"
  });
  // maybe we should use js animation here because we would not conflict with css
  const restoreToolbarIframeParentStyles = setStyles(toolbarIframeParent, {
    "scroll-padding-bottom": "40px",
    // same here we should add 40px
    "padding-bottom": "40px" // if there is already one we should add 40px
  });

  const restoreToolbarIframeStyles = setStyles(toolbarIframe, {
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
  hideToolbar = () => {
    restoreToolbarIframeParentStyles();
    restoreToolbarIframeStyles();
    hideTooltip(document.querySelector("#eventsource-indicator"));
    hideTooltip(document.querySelector("#execution-indicator"));
    toolbarVisibilityPreference.set(false);
    if (animate) {
      document.documentElement.setAttribute("data-toolbar-animation", "");
    } else {
      document.documentElement.removeAttribute("data-toolbar-animation");
    }
    document.documentElement.removeAttribute("data-toolbar-visible");
    sendEventToParent("toolbar-visibility-change", false);
  };
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
const sendEventToParent = (name, data) => {
  window.parent.postMessage({
    __jsenv__: {
      event: name,
      data
    }
  }, "*");
};
window.toolbar = {
  show: showToolbar,
  hide: () => hideToolbar()
};

// const { currentScript } = document
addExternalCommandCallback("renderToolbar", ({
  logs
}) => {
  renderToolbar();
});
addExternalCommandCallback("showToolbar", () => {
  showToolbar();
});
addExternalCommandCallback("hideToolbar", () => {
  hideToolbar();
});
sendEventToParent("toolbar_ready");
