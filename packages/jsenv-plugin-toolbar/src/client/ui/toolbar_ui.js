import { effect } from "../core/toolbar_state.js"
import { getAnimationsEnabled } from "../core/toolbar_animation.js"
import { getToolbarIframe, setStyles } from "./util/dom.js"
import { startJavaScriptAnimation } from "./util/animation.js"
import { hideAllTooltips } from "./tooltips/tooltips.js"
import { initToolbarMenuOverflow } from "./toolbar_menu_overflow/toolbar_menu_overflow.js"
import { renderToolbarOverlay } from "./toolbar_overlay/toolbar_overlay.js"
import { renderDocumentIndexLink } from "./document_index_link/document_index_link.js"
import { renderDocumentExecutionIndicator } from "./document_execution_indicator/document_execution_indicator.js"
import { renderServerIndicator } from "./server_indicator/server_indicator.js"
import { renderToolbarSettings } from "./toolbar_settings/toolbar_settings.js"
import { renderToolbarCloseButton } from "./toolbar_close_button/toolbar_close_button.js"

export const initToolbarUI = () => {
  effect(({ animationsEnabled }) => {
    if (animationsEnabled) {
      document.documentElement.setAttribute("data-toolbar-animation", "")
    } else {
      document.documentElement.removeAttribute("data-toolbar-animation")
    }
  })

  effect(({ opened }) => {
    if (opened) {
      showToolbar()
    } else {
      hideToolbar()
    }
  })

  initToolbarMenuOverflow()
  renderToolbarOverlay()
  renderDocumentIndexLink()
  renderDocumentExecutionIndicator()
  renderServerIndicator()
  renderToolbarSettings()
  renderToolbarCloseButton()
}

let restoreToolbarIframeParentStyles = () => {}
let restoreToolbarIframeStyles = () => {}

const hideToolbar = () => {
  hideAllTooltips()
  restoreToolbarIframeParentStyles()
  restoreToolbarIframeStyles()
  document.documentElement.removeAttribute("data-toolbar-visible")
}

// (by the way it might be cool to have the toolbar auto show when)
// it has something to say (being disconnected from server)
const showToolbar = () => {
  document.documentElement.setAttribute("data-toolbar-visible", "")

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
    "transition-duration": getAnimationsEnabled() ? "300ms" : "0s",
  })
  // maybe we should use js animation here because we would not conflict with css
  restoreToolbarIframeParentStyles = setStyles(toolbarIframeParent, {
    "scroll-padding-bottom": "40px", // same here we should add 40px
    "padding-bottom": "40px", // if there is already one we should add 40px
  })
  restoreToolbarIframeStyles = setStyles(toolbarIframe, {
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
}
