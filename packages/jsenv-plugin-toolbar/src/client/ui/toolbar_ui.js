import { updateToolbarState } from "../toolbar_state.js"
import { animationsAreEnabled } from "../core/toolbar_animation.js"
import { toolbarVisibilityPreference } from "../core/toolbar_visibility.js"
import { hideAllTooltip, hideTooltip } from "../tooltip/tooltip.js"
import {
  renderToolbarSettings,
  hideSettings,
} from "../settings/toolbar_settings.js"
import { renderToolbarNotification } from "../notification/toolbar_notification.js"
import { renderToolbarTheme } from "../theme/toolbar_theme.js"
import { renderExecutionInToolbar } from "../execution/toolbar_execution.js"
import { initToolbarEventSource } from "../eventsource/toolbar_eventsource.js"
import { makeToolbarResponsive } from "../responsive/toolbar_responsive.js"
import { setLinkHrefForParentWindow } from "./util/iframe_to_parent_href.js"
import {
  getToolbarIframe,
  deactivateToolbarSection,
  setStyles,
} from "./util/dom.js"
import { startJavaScriptAnimation } from "./util/animation.js"
import { renderToolbarAnimationSetting } from "./toolbar_animation_setting.js"

export const renderToolbar = async () => {
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
  renderToolbarAnimationSetting()
  renderToolbarTheme()
  renderExecutionInToolbar()
  // this might become active but we need to detect this somehow
  deactivateToolbarSection(document.querySelector("#file-list-link"))
  initToolbarEventSource()

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
  updateToolbarState({
    visible: false,
  })
}

// (by the way it might be cool to have the toolbar auto show when)
// it has something to say (being disconnected from server)
const showToolbar = () => {
  toolbarVisibilityPreference.set(true)
  if (animationsAreEnabled()) {
    document.documentElement.setAttribute("data-toolbar-animation", "")
  } else {
    document.documentElement.removeAttribute("data-toolbar-animation")
  }
  document.documentElement.setAttribute("data-toolbar-visible", "")

  updateToolbarState({
    visible: true,
  })

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
    "transition-duration": animationsAreEnabled() ? "300ms" : "0s",
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
    if (animationsAreEnabled()) {
      document.documentElement.setAttribute("data-toolbar-animation", "")
    } else {
      document.documentElement.removeAttribute("data-toolbar-animation")
    }
    document.documentElement.removeAttribute("data-toolbar-visible")
    updateToolbarState({
      visible: false,
    })
  }
}

window.toolbar = {
  show: showToolbar,
  hide: () => hideToolbar(),
}
