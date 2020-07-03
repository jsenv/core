import { registerNotifications } from "./util/notification.js"
import { createPreference } from "./util/preferences.js"
import { createHorizontalBreakpoint } from "./util/responsive.js"
import { hideTooltip } from "./tooltip/tooltip.js"
import {
  forceHideElement,
  removeForceHideElement,
  toolbarSectionIsActive,
  activateToolbarSection,
  deactivateToolbarSection,
} from "./util/dom.js"
import { renderToolbarTheme } from "./theme/toolbar.theme.js"
import { renderToolbarAnimation } from "./animation/toolbar.animation.js"
import { applyExecutionIndicator } from "./execution/toolbar.execution.js"
import { connectLivereload, disconnectLivereload } from "./livereloading/toolbar.livereloading.js"
import { makeToolbarResponsive } from "./responsive/toolbar.responsive.js"

const toolbarVisibilityPreference = createPreference("toolbar")

const WINDOW_MEDIUM_WIDTH = 570

const renderToolbar = () => {
  makeToolbarResponsive()

  const fileRelativeUrl = new URL(window.parent.document.location).pathname.slice(1)

  const toolbarVisible = toolbarVisibilityPreference.has()
    ? toolbarVisibilityPreference.get()
    : true

  if (toolbarVisible) {
    showToolbar({ animate: false })
  } else {
    hideToolbar({ animate: false })
  }

  const toolbarElement = document.querySelector("#toolbar")
  exposeOnParentWindow({
    toolbar: {
      element: toolbarElement,
      show: showToolbar,
      hide: hideToolbar,
    },
  })

  // settings
  document.querySelector("#settings-button").onclick = () => toggleSettingsBox()
  document.querySelector("#button-close-settings").onclick = () => toggleSettingsBox()
  registerNotifications()
  renderToolbarAnimation()
  renderToolbarTheme()

  // close button
  document.querySelector("#button-close-toolbar").onclick = () => toogleToolbar()

  // apply responsive design on fileInput if needed + add listener on resize screen
  const input = document.querySelector("#file-input")
  const fileWidthBreakpoint = createHorizontalBreakpoint(WINDOW_MEDIUM_WIDTH)
  const handleFileWidthBreakpoint = () => {
    resizeInput(input, fileWidthBreakpoint)
  }
  handleFileWidthBreakpoint()
  fileWidthBreakpoint.changed.listen(handleFileWidthBreakpoint)

  // ça ça va changer je sais pas encore comment
  if (fileRelativeUrl) {
    connectLivereload()

    input.value = fileRelativeUrl
    resizeInput(input, fileWidthBreakpoint)

    // reset file execution indicator ui
    applyExecutionIndicator()

    activateToolbarSection(document.querySelector("#file"))
    deactivateToolbarSection(document.querySelector("#file-list-link"))
    removeForceHideElement(document.querySelector("#file"))
    removeForceHideElement(document.querySelector("#livereload-indicator"))
    removeForceHideElement(document.querySelector("#execution-indicator"))
  } else {
    disconnectLivereload()
    forceHideElement(document.querySelector("#file"))
    forceHideElement(document.querySelector("#livereload-indicator"))
    forceHideElement(document.querySelector("#execution-indicator"))
    deactivateToolbarSection(document.querySelector("#file"))
    activateToolbarSection(document.querySelector("#file-list-link"))
  }
}

const exposeOnParentWindow = (object) => {
  let { __jsenv__ } = window.parent
  if (!__jsenv__) {
    __jsenv__ = {}
    window.parent.__jsenv__ = {}
  }

  Object.assign(__jsenv__, object)
}

const toogleToolbar = () => {
  // if user click enter or space quickly while closing toolbar
  // it will cancel the closing
  if (toolbarIsVisible()) {
    hideToolbar()
  } else {
    showToolbar()
  }
}

const toolbarIsVisible = () => document.documentElement.hasAttribute("data-toolbar-visible")

export const showToolbar = ({ animate = true } = {}) => {
  toolbarVisibilityPreference.set(true)
  if (animate) {
    document.documentElement.setAttribute("data-toolbar-animation", "")
  } else {
    document.documentElement.removeAttribute("data-toolbar-animation")
  }
  document.documentElement.setAttribute("data-toolbar-visible", "")
}

export const hideToolbar = ({ animate = true } = {}) => {
  hideTooltip(document.querySelector("#livereload-indicator"))
  hideTooltip(document.querySelector("#execution-indicator"))
  toolbarVisibilityPreference.set(false)
  if (animate) {
    document.documentElement.setAttribute("data-toolbar-animation", "")
  } else {
    document.documentElement.removeAttribute("data-toolbar-animation")
  }
  document.documentElement.removeAttribute("data-toolbar-visible")

  // toolbarTrigger: display and register onclick
  const toolbarTrigger = document.querySelector("#toolbar-trigger")
  var timer
  toolbarTrigger.onmouseenter = () => {
    toolbarTrigger.setAttribute("data-animate", "")
    timer = setTimeout(expandToolbarTrigger, 500)
  }
  toolbarTrigger.onmouseleave = () => {
    clearTimeout(timer)
    collapseToolbarTrigger()
  }
  toolbarTrigger.onfocus = () => {
    toolbarTrigger.removeAttribute("data-animate")
    expandToolbarTrigger()
  }
  toolbarTrigger.onblur = () => {
    toolbarTrigger.removeAttribute("data-animate")
    clearTimeout(timer)
    collapseToolbarTrigger()
  }
  toolbarTrigger.onclick = showToolbar
  // toolbarTrigger is hidden by default to avoid being shown
  // when toolbar is shown on page load, ensure it's visible once toolbar is hidden
  removeForceHideElement(toolbarTrigger)
}

const expandToolbarTrigger = () => {
  const toolbarTrigger = document.querySelector("#toolbar-trigger")
  toolbarTrigger.setAttribute("data-expanded", "")
}

const collapseToolbarTrigger = () => {
  const toolbarTrigger = document.querySelector("#toolbar-trigger")
  toolbarTrigger.removeAttribute("data-expanded", "")
}

const resizeInput = (input, fileWidthBreakpoint) => {
  const size = fileWidthBreakpoint.isBelow() ? 20 : 40
  if (input.value.length > size) {
    input.style.width = `${size}ch`
  } else {
    input.style.width = `${input.value.length}ch`
  }
}

const toggleSettingsBox = () => {
  const settings = document.querySelector(`#settings`)
  if (toolbarSectionIsActive(settings)) {
    deactivateToolbarSection(settings)
  } else {
    activateToolbarSection(settings)
  }
}

renderToolbar()
