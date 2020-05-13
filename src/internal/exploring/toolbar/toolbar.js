import { registerNotifications } from "../util/notification.js"
import { createPreference } from "../util/preferences.js"
import { createHorizontalBreakpoint } from "../util/responsive.js"
import { hideTooltip } from "./tooltip.js"
import { renderToolbarTheme } from "./toolbar-theme.js"
import { renderToolbarAnimation } from "./toolbar-animation.js"
import { applyExecutionIndicator } from "./execution-indicator.js"
import { connectLivereload, disconnectLivereload } from "./toolbar-livereloading.js"

const toolbarVisibilityPreference = createPreference("toolbar")

const WINDOW_SMALL_WIDTH = 420
const WINDOW_MEDIUM_WIDTH = 570

export const renderToolbar = (attempt) => {
  const fileRelativeUrl = new URL(attempt.url).pathname.slice(1)

  const toolbarVisible = toolbarVisibilityPreference.has()
    ? toolbarVisibilityPreference.get()
    : true

  if (toolbarVisible) {
    showToolbar({ animate: false })
  } else {
    hideToolbar({ animate: false })
  }

  const toolbarElement = document.querySelector("#toolbar")
  window.toolbar = {
    element: toolbarElement,
    show: showToolbar,
    hide: hideToolbar,
  }

  // settings
  document.querySelector("#settings-button").onclick = () => toggleSettingsBox()
  document.querySelector("#button-close-settings").onclick = () => toggleSettingsBox()
  registerNotifications()
  renderToolbarAnimation()
  renderToolbarTheme()

  // close button
  document.querySelector("#button-close-toolbar").onclick = () => toogleToolbar()

  // overflow menu
  document.querySelector("#overflow-menu-button").onclick = () => toggleOverflowMenu()

  // apply responsive design on fileInput if needed + add listener on resize screen
  const input = document.querySelector("#file-input")
  const fileWidthBreakpoint = createHorizontalBreakpoint(WINDOW_MEDIUM_WIDTH)
  const handleFileWidthBreakpoint = () => {
    resizeInput(input, fileWidthBreakpoint)
  }
  handleFileWidthBreakpoint()
  fileWidthBreakpoint.changed.listen(handleFileWidthBreakpoint)

  if (fileRelativeUrl) {
    connectLivereload(attempt)

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

let moves = []

const responsiveToolbar = (overflowMenuBreakpoint) => {
  // close all tooltips in case opened
  hideTooltip(document.querySelector("#livereload-indicator"))
  hideTooltip(document.querySelector("#execution-indicator"))
  // close settings box in case opened
  deactivateToolbarSection(document.querySelector("#settings"))

  if (overflowMenuBreakpoint.isBelow()) {
    enableOverflow()
  } else {
    disableOverflow()
  }
}

const enableOverflow = () => {
  // move elements from toolbar to overflow menu
  const responsiveToolbarElements = document.querySelectorAll("[data-responsive-toolbar-element]")
  const overflowMenu = document.querySelector("#overflow-menu")

  // keep a placeholder element to know where to move them back
  moves = Array.from(responsiveToolbarElements).map((element) => {
    const placeholder = document.createElement("div")
    placeholder.style.display = "none"
    placeholder.setAttribute("data-placeholder", "")
    element.parentNode.replaceChild(placeholder, element)
    overflowMenu.appendChild(element)
    return { element, placeholder }
  })

  document.querySelector("#toolbar").setAttribute("data-overflow-menu-enabled", "")
  removeForceHideElement(document.querySelector("#overflow-menu-button"))
}

const disableOverflow = () => {
  // close overflow menu in case it's open & unselect toggleOverflowMenu button in case it's selected
  hideOverflowMenu()
  deactivateToolbarSection(document.querySelector("#overflow-menu"))
  moves.forEach(({ element, placeholder }) => {
    placeholder.parentNode.replaceChild(element, placeholder)
  })
  moves = []

  document.querySelector("#toolbar").removeAttribute("data-overflow-menu-enabled")
  forceHideElement(document.querySelector("#overflow-menu-button"))
}

const forceHideElement = (element) => {
  element.setAttribute("data-force-hide", "")
}

const removeForceHideElement = (element) => {
  element.removeAttribute("data-force-hide")
}

const activateToolbarSection = (element) => {
  element.setAttribute("data-active", "")
}

const deactivateToolbarSection = (element) => {
  element.removeAttribute("data-active")
}

const toolbarSectionIsActive = (element) => {
  return element.hasAttribute("data-active")
}

const toolbarIsVisible = () => document.documentElement.hasAttribute("data-toolbar-visible")

const toogleToolbar = () => {
  // if user click enter or space quickly while closing toolbar
  // it will cancel the closing
  if (toolbarIsVisible()) {
    hideToolbar()
  } else {
    showToolbar()
  }
}

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

const overflowMenuIsVisible = () => {
  const toolbar = document.querySelector("#toolbar")
  return toolbar.hasAttribute("data-overflow-menu-visible")
}

const showOverflowMenu = () => {
  const toolbar = document.querySelector("#toolbar")
  document.querySelector("#overflow-menu").setAttribute("data-animate", "")
  toolbar.setAttribute("data-overflow-menu-visible", "")
}

const hideOverflowMenu = () => {
  const toolbar = document.querySelector("#toolbar")
  toolbar.removeAttribute("data-overflow-menu-visible")
  document.querySelector("#overflow-menu").removeAttribute("data-animate")
}

const toggleOverflowMenu = () => {
  if (overflowMenuIsVisible()) {
    hideOverflowMenu()
  } else {
    showOverflowMenu()
  }
}

// apply responsive design on toolbar icons if needed + add listener on resize screen
// ideally we should listen breakpoint once, for now restore toolbar
const overflowMenuBreakpoint = createHorizontalBreakpoint(WINDOW_SMALL_WIDTH)
const handleOverflowMenuBreakpoint = () => {
  responsiveToolbar(overflowMenuBreakpoint)
}
handleOverflowMenuBreakpoint()
overflowMenuBreakpoint.changed.listen(handleOverflowMenuBreakpoint)
