import { effect } from "@preact/signals";

import { animationsEnabledSignal } from "../../core/animation_signals.js";
import { openedSignal } from "../../core/toolbar_open_signals.js";
import { closeAllTooltips } from "../../core/tooltip_actions.js";
import { startJavaScriptAnimation } from "../util/animation.js";
import { getToolbarIframe, setStyles } from "../util/dom.js";

export const initToolbarOpening = () => {
  effect(() => {
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
  const parentDocumentElement =
    parentWindow.document.compatMode === "CSS1Compat"
      ? parentWindow.document.documentElement
      : parentWindow.document.body;

  const scrollYMax =
    parentDocumentElement.scrollHeight - parentWindow.innerHeight;
  const scrollY = parentDocumentElement.scrollTop;
  const scrollYRemaining = scrollYMax - scrollY;

  setStyles(toolbarIframeParent, {
    "transition-property": "padding-bottom",
    "transition-duration": animationsEnabled ? "300ms" : "0s",
  });
  // maybe we should use js animation here because we would not conflict with css
  restoreToolbarIframeParentStyles = setStyles(toolbarIframeParent, {
    "scroll-padding-bottom": "40px", // same here we should add 40px
    "padding-bottom": "40px", // if there is already one we should add 40px
  });
  restoreToolbarIframeStyles = setStyles(toolbarIframe, {
    height: "40px",
    visibility: "visible",
  });

  if (scrollYRemaining < 40 && scrollYMax > 0) {
    const scrollEnd = scrollY + 40;
    startJavaScriptAnimation({
      duration: 300,
      onProgress: ({ progress }) => {
        const value = scrollY + (scrollEnd - scrollY) * progress;
        parentDocumentElement.scrollTop = value;
      },
    });
  }
};
