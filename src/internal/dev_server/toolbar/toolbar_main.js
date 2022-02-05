import { urlIsInsideOf } from "@jsenv/filesystem/src/urlIsInsideOf.js"
import { urlToRelativeUrl } from "@jsenv/filesystem/src/urlToRelativeUrl.js"

import { startJavaScriptAnimation } from "../toolbar/util/animation.js"
import "./focus/toolbar_focus.js"
import { setLinkHrefForParentWindow } from "./util/iframe_to_parent_href.js"
import {
  getToolbarIframe,
  deactivateToolbarSection,
  setStyles,
} from "./util/dom.js"
import { createPreference } from "./util/preferences.js"
import { hideTooltip, hideAllTooltip } from "./tooltip/tooltip.js"
import {
  renderToolbarSettings,
  hideSettings,
} from "./settings/toolbar_settings.js"
import { renderToolbarNotification } from "./notification/toolbar_notification.js"
import { renderToolbarTheme } from "./theme/toolbar_theme.js"
import { renderToolbarAnimation } from "./animation/toolbar_animation.js"
import { renderExecutionInToolbar } from "./execution/toolbar_execution.js"
import { renderCompilationInToolbar } from "./compilation/toolbar_compilation.js"
import { initToolbarEventSource } from "./eventsource/toolbar_eventsource.js"
import { makeToolbarResponsive } from "./responsive/toolbar_responsive.js"

const toolbarVisibilityPreference = createPreference("toolbar")

const renderToolbar = async ({ exploringJSON }) => {
  const { jsenvDirectoryRelativeUrl, hmr } = exploringJSON
  const executedFileCompiledUrl = window.parent.location.href
  const compileServerOrigin = window.parent.location.origin
  const compileGroup = getCompileGroup({
    executedFileCompiledUrl,
    jsenvDirectoryRelativeUrl,
    compileServerOrigin,
  })
  const executedFileRelativeUrl = compileGroup.fileRelativeUrl

  const toolbarOverlay = document.querySelector("#toolbar-overlay")
  toolbarOverlay.onclick = () => {
    hideAllTooltip()
    hideSettings()
  }

  const toolbarVisible = toolbarVisibilityPreference.has()
    ? toolbarVisibilityPreference.get()
    : true

  if (toolbarVisible) {
    showToolbar({ animate: false })
  } else {
    hideToolbar({ animate: false })
  }

  setLinkHrefForParentWindow(
    document.querySelector(".toolbar-icon-wrapper"),
    "/",
  )

  renderToolbarNotification()
  makeToolbarResponsive()
  renderToolbarSettings()
  renderToolbarAnimation()
  renderToolbarTheme()
  renderExecutionInToolbar({
    executedFileRelativeUrl,
  })
  renderCompilationInToolbar({
    jsenvDirectoryRelativeUrl,
    compileGroup,
  })
  // this might become active but we need to detect this somehow
  deactivateToolbarSection(document.querySelector("#file-list-link"))
  initToolbarEventSource({
    executedFileRelativeUrl,
    hmr,
  })

  // if user click enter or space quickly while closing toolbar
  // it will cancel the closing
  // that's why I used toggleToolbar and not hideToolbar
  document.querySelector("#button-close-toolbar").onclick = () =>
    toogleToolbar()
}

const toogleToolbar = () => {
  if (toolbarIsVisible()) {
    hideToolbar()
  } else {
    showToolbar()
  }
}

const toolbarIsVisible = () =>
  document.documentElement.hasAttribute("data-toolbar-visible")

let hideToolbar = () => {
  // toolbar hidden by default, nothing to do to hide it by default
  sendEventToParent("toolbar-visibility-change", false)
}

// (by the way it might be cool to have the toolbar auto show when)
// it has something to say (being disconnected from livereload server)
const showToolbar = ({ animate = true } = {}) => {
  toolbarVisibilityPreference.set(true)
  if (animate) {
    document.documentElement.setAttribute("data-toolbar-animation", "")
  } else {
    document.documentElement.removeAttribute("data-toolbar-animation")
  }
  document.documentElement.setAttribute("data-toolbar-visible", "")

  sendEventToParent("toolbar-visibility-change", true)

  const toolbarIframe = getToolbarIframe()
  const toolbarIframeParent = toolbarIframe.parentNode
  const parentWindow = window.parent
  const parentDocumentElement =
    parentWindow.document.compatMode === "CSS1Compat"
      ? parentWindow.document.documentElement
      : parentWindow.document.body

  const scrollYMax =
    parentDocumentElement.scrollHeight - parentWindow.innerHeight
  const scrollY = parentDocumentElement.scrollTop
  const scrollYRemaining = scrollYMax - scrollY

  setStyles(toolbarIframeParent, {
    "transition-property": "padding-bottom",
    "transition-duration": "300ms",
  })
  // maybe we should use js animation here because we would not conflict with css
  const restoreToolbarIframeParentStyles = setStyles(toolbarIframeParent, {
    "scroll-padding-bottom": "40px", // same here we should add 40px
    "padding-bottom": "40px", // if there is already one we should add 40px
  })
  const restoreToolbarIframeStyles = setStyles(toolbarIframe, {
    height: "40px",
    visibility: "visible",
  })

  if (scrollYRemaining < 40 && scrollYMax > 0) {
    const scrollEnd = scrollY + 40
    startJavaScriptAnimation({
      duration: 300,
      onProgress: ({ progress }) => {
        const value = scrollY + (scrollEnd - scrollY) * progress
        parentDocumentElement.scrollTop = value
      },
    })
  }

  hideToolbar = () => {
    restoreToolbarIframeParentStyles()
    restoreToolbarIframeStyles()

    hideTooltip(document.querySelector("#eventsource-indicator"))
    hideTooltip(document.querySelector("#execution-indicator"))
    toolbarVisibilityPreference.set(false)
    if (animate) {
      document.documentElement.setAttribute("data-toolbar-animation", "")
    } else {
      document.documentElement.removeAttribute("data-toolbar-animation")
    }
    document.documentElement.removeAttribute("data-toolbar-visible")
    sendEventToParent("toolbar-visibility-change", false)
  }
}

const getCompileGroup = ({
  executedFileCompiledUrl,
  jsenvDirectoryRelativeUrl,
  compileServerOrigin,
}) => {
  const jsenvDirectoryServerUrl = new URL(
    jsenvDirectoryRelativeUrl,
    compileServerOrigin,
  ).href
  if (urlIsInsideOf(executedFileCompiledUrl, jsenvDirectoryServerUrl)) {
    const afterCompileDirectory = urlToRelativeUrl(
      executedFileCompiledUrl,
      jsenvDirectoryServerUrl,
    )
    const slashIndex = afterCompileDirectory.indexOf("/")
    const fileRelativeUrl = afterCompileDirectory.slice(slashIndex + 1)
    return {
      fileRelativeUrl,
      compileId: afterCompileDirectory.slice(0, slashIndex),
    }
  }
  return {
    fileRelativeUrl: new URL(executedFileCompiledUrl).pathname.slice(1),
    compileId: null,
  }
}

const addExternalCommandCallback = (command, callback) => {
  const messageEventCallback = (messageEvent) => {
    const { data } = messageEvent
    if (typeof data !== "object") {
      return
    }
    const { __jsenv__ } = data
    if (!__jsenv__) {
      return
    }

    if (__jsenv__.command !== command) {
      return
    }

    callback(...__jsenv__.args)
  }

  window.addEventListener("message", messageEventCallback)
  return () => {
    window.removeEventListener("message", messageEventCallback)
  }
}

const sendEventToParent = (name, data) => {
  window.parent.postMessage(
    {
      __jsenv__: {
        event: name,
        data,
      },
    },
    "*",
  )
}

window.toolbar = {
  show: showToolbar,
  hide: () => hideToolbar(),
}

// const { currentScript } = document
addExternalCommandCallback("renderToolbar", ({ exploringJSON }) => {
  renderToolbar({
    exploringJSON,
    //  toolbarScript: currentScript,
  })
})
addExternalCommandCallback("showToolbar", () => {
  showToolbar()
})
addExternalCommandCallback("hideToolbar", () => {
  hideToolbar()
})
sendEventToParent("toolbar_ready")
