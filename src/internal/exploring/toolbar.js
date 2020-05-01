import { getNotificationPreference, setNotificationPreference } from "./notification.js"
import { createPreference } from "./preferences.js"

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

  if (fileRelativeUrl) {
    document.querySelector("#button-state-indicator").onclick = () => toggleTooltip("serverState")
    document.querySelector("#button-state-indicator").style.display = ""

    const input = document.querySelector(".fileName")
    input.value = fileRelativeUrl
    resizeInput(input)

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

  // apply responsive design if needed + add listener on resize screen
  responsiveToolbar()
  window.onresize = () => responsiveToolbar()
}

const responsiveToolbar = () => {
  const size = document.documentElement.clientWidth
  resizeInput(document.querySelector(".fileName"))

  // close all tooltips in case it's open
  document.querySelector(".serverState").classList.remove("tooltipVisible")
  document.querySelector(".fileExecution").classList.remove("tooltipVisible")

  // close settings box in case it's open
  document.querySelector(".settings-icon-wrapper").classList.remove("iconToolbar-selected")
  document.querySelector(".settingsBox").classList.remove("settingsBox-visible")

  // unselect toggleOverflowMenu button in case it's selected
  document.querySelector("#button-overflow-menu").classList.remove("active")

  if (size < WINDOW_SMALL_WIDTH) {
    // detect it becomes too small
    document.body.style.backgroundColor = "yellow"
    // move elements from toolbar to overflow menu
    const responsiveToolbarElements = document.querySelectorAll("[data-responsive-toolbar-element]")
    const overflowMenu = document.querySelector("#overflowMenu")
    Array.from(responsiveToolbarElements).forEach((element) => {
      overflowMenu.appendChild(element)
    })
  } else {
    // detect it becomes too big
    document.body.style.backgroundColor = "pink"
    // close overflow menu in case it's open
    closeOverflowMenu()

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
    <svg id="powerIconSvg" class="iconTooltip">
      <use xlink:href="#powerIconSvgModel"></use>
    </svg>
    <a href="javascript:void(0);">connect</a>`
    tooltiptext.querySelector("a").onclick = connect
  } else if (state === "connecting") {
    stateIndicator.classList.add("loadingCircle")
    stateIndicatorRing.classList.add("loadingRing")
    tooltiptext.innerHTML = `Connecting to livereload event source... <a href="javascript:void(0);">cancel</a>`
    tooltiptext.querySelector("a").onclick = abort
  } else if (state === "connected") {
    stateIndicator.classList.add("greenCircle")
    tooltiptext.innerHTML = `Connected to livereload server
    <div><svg id="powerOffIconSvg" class="iconTooltip">
      <use xlink:href="#powerOffIconSvgModel"></use>
    </svg>
    <a href="javascript:void(0);">disconnect</a></div>`
    tooltiptext.querySelector("a").onclick = disconnect
  } else if (state === "disconnected") {
    stateIndicator.classList.add("redCircle")
    tooltiptext.innerHTML = `Disconnected from livereload server <a href="javascript:void(0);">reconnect</a>`
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

export const resizeInput = (input) => {
  const size = document.documentElement.clientWidth < WINDOW_MEDIUM_WIDTH ? 20 : 40
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
