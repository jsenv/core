import { getNotificationPreference, setNotificationPreference } from "./notification.js"
import { createPreference } from "./preferences.js"
import { createHorizontalBreakpoint } from "./responsive.js"

const toolbarVisibilityPreference = createPreference("toolbar")

const WINDOW_SMALL_WIDTH = 420
const WINDOW_MEDIUM_WIDTH = 570

export const renderToolbar = (fileRelativeUrl) => {
  const toolbarVisible = toolbarVisibilityPreference.has()
    ? toolbarVisibilityPreference.get()
    : true

  if (toolbarVisible) {
    showToolbar()
  } else {
    hideToolbar()
  }

  const toolbarElement = document.querySelector("#toolbar")
  window.toolbar = {
    element: toolbarElement,
    show: showToolbar,
    hide: hideToolbar,
  }

  document.querySelector("#button-toggle-settings").onclick = () => toggleSettingsBox()

  document.querySelector("#button-close-toolbar").onclick = () => {
    // if user click enter or space quickly while closing toolbar
    // it will cancel the closing
    if (isVisible()) {
      hideToolbar()
    } else {
      showToolbar()
    }
  }

  document.querySelector("#button-overflow-menu").onclick = () => toggleOverflowMenu()

  document.querySelector("#button-toggle-settings").onclick = () => toggleSettingsBox()

  const notifCheckbox = document.querySelector("#toggle-notifs")
  notifCheckbox.checked = getNotificationPreference()
  notifCheckbox.onchange = () => {
    setNotificationPreference(notifCheckbox.checked)
  }

  // apply responsive design on fileInput if needed + add listener on resize screen
  const fileWidthBreakpoint = createHorizontalBreakpoint(WINDOW_MEDIUM_WIDTH)
  const handleFileWidthBreakpoint = () => {
    resizeInput(document.querySelector(".fileName"), fileWidthBreakpoint)
  }
  handleFileWidthBreakpoint()
  fileWidthBreakpoint.changed.listen(handleFileWidthBreakpoint)

  if (fileRelativeUrl) {
    document.querySelector("#button-state-indicator").onclick = () => toggleTooltip("serverState")
    document.querySelector("#button-state-indicator").style.display = ""

    const input = document.querySelector(".fileName")
    input.value = fileRelativeUrl
    resizeInput(input, fileWidthBreakpoint)

    document.querySelector(".fileNameContainer").style.display = "table-cell"
    document.querySelector("#button-execution-indicator").onclick = () =>
      toggleTooltip("fileExecution")
    document.querySelector("#button-execution-indicator").style.display = ""
    document.querySelector(".file-icon-wrapper").classList.remove("iconToolbar-selected")
  } else {
    document.querySelector(".fileNameContainer").style.display = "none"
    document.querySelector("#button-state-indicator").style.display = "none"
    document.querySelector("#button-execution-indicator").style.display = "none"
    document.querySelector(".file-icon-wrapper").classList.add("iconToolbar-selected")
  }

  // apply responsive design on toolbar icons if needed + add listener on resize screen
  const overflowMenuBreakpoint = createHorizontalBreakpoint(WINDOW_SMALL_WIDTH)
  const handleOverflowMenuBreakpoint = () => {
    responsiveToolbar(overflowMenuBreakpoint)
  }
  handleOverflowMenuBreakpoint()
  overflowMenuBreakpoint.changed.listen(handleOverflowMenuBreakpoint)
}

const responsiveToolbar = (overflowMenuBreakpoint) => {
  // close all tooltips in case it's open
  document.querySelector(".serverState").classList.remove("tooltipVisible")
  document.querySelector(".fileExecution").classList.remove("tooltipVisible")

  // close settings box in case it's open
  document.querySelector(".settings-icon-wrapper").classList.remove("iconToolbar-selected")
  document.querySelector(".settingsBox").classList.remove("settingsBox-visible")

  if (overflowMenuBreakpoint.isBelow()) {
    // move elements from toolbar to overflow menu
    const responsiveToolbarElements = document.querySelectorAll("[data-responsive-toolbar-element]")
    const overflowMenu = document.querySelector("#overflowMenu")
    Array.from(responsiveToolbarElements).forEach((element) => {
      overflowMenu.appendChild(element)
    })
  } else {
    // close overflow menu in case it's open & unselect toggleOverflowMenu button in case it's selected
    closeOverflowMenu()
    document.querySelector("#button-overflow-menu").classList.remove("active")

    // move elements from overflow menu to toolbar
    const responsiveToolbarElements = document.querySelectorAll("[data-responsive-toolbar-element]")

    const toolbar = document.querySelector("#toolbar-wrapper")
    Array.from(responsiveToolbarElements).forEach((element) => {
      if (element.id === "page-file-link") {
        toolbar.insertBefore(element, toolbar.firstElementChild)
      } else {
        toolbar.appendChild(element)
      }
    })
  }
}

const isVisible = () => document.documentElement.hasAttribute("data-toolbar-visible")

export const applyStateIndicator = (state, { connect, abort, disconnect, reconnect }) => {
  const stateIndicator = document.getElementById("stateIndicatorCircle")
  const stateIndicatorRing = document.getElementById("stateIndicatorRing")
  const tooltiptext = document.querySelector(".tooltipTextServerState")

  // remove all classes before applying the right ones
  stateIndicatorRing.classList.remove("loadingRing")
  stateIndicator.classList.remove("loadingCircle", "redCircle", "greenCircle")

  if (state === "off") {
    tooltiptext.innerHTML = `Livereloading disabled
    <br /><div class="tooltipAction">
      <svg id="powerIconSvg" class="tooltipIcon">
        <use xlink:href="#powerIconSvgModel"></use>
      </svg>      
      <a href="javascript:void(0);">connect</a>
    </div>`
    tooltiptext.querySelector("a").onclick = connect
  } else if (state === "connecting") {
    stateIndicator.classList.add("loadingCircle")
    stateIndicatorRing.classList.add("loadingRing")
    tooltiptext.innerHTML = `Connecting to livereload event source...
    <br /><div class="tooltipAction">
      <svg id="powerOffIconSvg" class="tooltipIcon">
        <use xlink:href="#powerOffIconSvgModel"></use>
      </svg>
      <a href="javascript:void(0);">cancel</a>
    </div>`
    tooltiptext.querySelector("a").onclick = abort
  } else if (state === "connected") {
    stateIndicator.classList.add("greenCircle")
    tooltiptext.innerHTML = `Connected to livereload server
    <br /><div class="tooltipAction">
      <svg id="powerOffIconSvg" class="tooltipIcon">
        <use xlink:href="#powerOffIconSvgModel"></use>
      </svg>
      <a href="javascript:void(0);">disconnect</a>
    </div>`
    tooltiptext.querySelector("a").onclick = disconnect
  } else if (state === "disconnected") {
    stateIndicator.classList.add("redCircle")
    tooltiptext.innerHTML = `Disconnected from livereload server
    <br /><div class="tooltipAction">
      <svg id="powerIconSvg" class="tooltipIcon">
        <use xlink:href="#powerIconSvgModel"></use>
      </svg>      
      <a href="javascript:void(0);">reconnect</a>
    </div>`
    tooltiptext.querySelector("a").onclick = reconnect
  }
}

export const applyFileExecutionIndicator = (state, duration) => {
  const checkIcon = document.getElementById("checkIconSvg")
  const crossIcon = document.getElementById("failIconSvg")
  const loader = document.getElementById("loaderSvg")
  const tooltiptext = document.querySelector(".tooltipTextFileExecution")

  // remove all classes before applying the right ones
  checkIcon.classList.remove("animateCheck")
  crossIcon.classList.remove("animateCross")
  loader.classList.remove("animateLoader")

  if (state === "loading") {
    loader.classList.add("animateLoader")
    tooltiptext.innerHTML = "Executing..."
  } else if (state === "success") {
    checkIcon.classList.add("animateCheck")
    tooltiptext.innerHTML = `Execution completed in ${duration}ms`
  } else if (state === "failure") {
    crossIcon.classList.add("animateCross")
    tooltiptext.innerHTML = `Execution failed in ${duration}ms`
  }
}

export const showToolbar = () => {
  document.querySelector("#toolbarTrigger").classList.remove("toolbarTriggerVisible")
  document.querySelector("#toolbar").removeAttribute("tabIndex")
  document.documentElement.setAttribute("data-toolbar-visible", "")
  toolbarVisibilityPreference.set(true)
}

export const hideToolbar = () => {
  document.querySelector("#toolbar").setAttribute("tabIndex", -1)
  document.querySelector(".serverState").classList.remove("tooltipVisible")
  document.querySelector(".fileExecution").classList.remove("tooltipVisible")
  document.documentElement.removeAttribute("data-toolbar-visible")
  toolbarVisibilityPreference.set(false)

  // toolbarTrigger: display and register onclick
  const toolbarTrigger = document.querySelector("#toolbarTrigger")
  toolbarTrigger.classList.add("toolbarTriggerVisible")
  var timer
  toolbarTrigger.onmouseover = () => {
    timer = setTimeout(() => {
      showJsenvLogo()
    }, 500)
  }
  toolbarTrigger.onmouseout = () => {
    clearTimeout(timer)
  }
}

const showJsenvLogo = () => {
  const toolbarTrigger = document.querySelector("#toolbarTrigger")
  toolbarTrigger.classList.add("toolbarTriggerUp")
  const jsenvLogo = document.querySelector("#jsenvLogo")
  jsenvLogo.classList.add("jsenvLogoVisible")
  // mouse leave to close
  jsenvLogo.onmouseleave = () => {
    hideJsenvLogo()
  }
  // click inside to open toolbar
  jsenvLogo.onclick = (event) => {
    event.stopPropagation()
    showToolbar()
  }
}

const hideJsenvLogo = () => {
  document.querySelector("#toolbarTrigger").classList.remove("toolbarTriggerUp")
  document.querySelector("#jsenvLogo").classList.remove("jsenvLogoVisible")
}

export const resizeInput = (input, fileWidthBreakpoint) => {
  const size = fileWidthBreakpoint.isBelow() ? 20 : 40
  if (input.value.length > size) {
    input.style.width = `${size}ch`
  } else {
    input.style.width = `${input.value.length}ch`
  }
}

const toggleTooltip = (name) => {
  document.querySelector(`.${name}`).classList.toggle("tooltipVisible")
}

const toggleSettingsBox = () => {
  document.querySelector(".settings-icon-wrapper").classList.toggle("iconToolbar-selected")
  document.querySelector(".settingsBox").classList.toggle("settingsBox-visible")
}

const toggleOverflowMenu = () => {
  const overflowMenu = document.querySelector("#overflowMenu")
  const buttonOverflowMenu = document.querySelector("#button-overflow-menu")
  // if the menu is open
  if (overflowMenu.classList.contains("overflowMenu-visible")) {
    closeOverflowMenu()
    buttonOverflowMenu.classList.remove("active")
  } else {
    overflowMenu.classList.add("overflowMenu-visible")
    buttonOverflowMenu.classList.add("active")
  }
}

const closeOverflowMenu = () => {
  // document.querySelector("#overflowMenu").classList.add("overflowMenu-removing")
  // setTimeout(() => {
  document.querySelector("#overflowMenu").classList.remove("overflowMenu-visible")
  //     document.querySelector("#overflowMenu").classList.remove("overflowMenu-removing")
  //   }, 400)
}
