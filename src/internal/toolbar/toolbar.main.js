/* eslint-disable import/max-dependencies */
import { removeForceHideElement, deactivateToolbarSection } from "./util/dom.js"
import { registerNotifications } from "./util/notification.js"
import { createPreference } from "./util/preferences.js"
import { hideTooltip } from "./tooltip/tooltip.js"
import { renderToolbarSettings } from "./settings/toolbar.settings.js"
import { renderToolbarTheme } from "./theme/toolbar.theme.js"
import { renderToolbarAnimation } from "./animation/toolbar.animation.js"
import { renderExecutionInToolbar } from "./execution/toolbar.execution.js"
import { connectLivereload } from "./livereloading/toolbar.livereloading.js"
import { makeToolbarResponsive } from "./responsive/toolbar.responsive.js"

const toolbarVisibilityPreference = createPreference("toolbar")

const renderToolbar = () => {
  const toolbarElement = document.querySelector("#toolbar")
  exposeOnParentWindow({
    toolbar: {
      element: toolbarElement,
      show: showToolbar,
      hide: hideToolbar,
    },
  })

  const toolbarVisible = toolbarVisibilityPreference.has()
    ? toolbarVisibilityPreference.get()
    : true

  if (toolbarVisible) {
    showToolbar({ animate: false })
  } else {
    hideToolbar({ animate: false })
  }

  // close button
  document.querySelector("#button-close-toolbar").onclick = () => toogleToolbar()

  registerNotifications()
  makeToolbarResponsive()
  renderToolbarSettings()
  renderToolbarAnimation()
  renderToolbarTheme()
  renderExecutionInToolbar()
  connectLivereload()
  deactivateToolbarSection(document.querySelector("#file-list-link"))

  // } else {
  //   disconnectLivereload()
  //   forceHideElement(document.querySelector("#file"))
  //   forceHideElement(document.querySelector("#livereload-indicator"))
  //   forceHideElement(document.querySelector("#execution-indicator"))
  //   deactivateToolbarSection(document.querySelector("#file"))
  //   activateToolbarSection(document.querySelector("#file-list-link"))
  // }
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

const showToolbar = ({ animate = true } = {}) => {
  toolbarVisibilityPreference.set(true)
  if (animate) {
    document.documentElement.setAttribute("data-toolbar-animation", "")
  } else {
    document.documentElement.removeAttribute("data-toolbar-animation")
  }
  document.documentElement.setAttribute("data-toolbar-visible", "")
}

const hideToolbar = ({ animate = true } = {}) => {
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

renderToolbar()
