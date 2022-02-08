import {
  forceHideElement,
  removeForceHideElement,
  deactivateToolbarSection,
} from "../util/dom.js"
import { createHorizontalBreakpoint } from "../util/responsive.js"
import { hideTooltip } from "../tooltip/tooltip.js"

const WINDOW_SMALL_WIDTH = 420

export const makeToolbarResponsive = () => {
  // apply responsive design on toolbar icons if needed + add listener on resize screen
  // ideally we should listen breakpoint once, for now restore toolbar
  const overflowMenuBreakpoint = createHorizontalBreakpoint(WINDOW_SMALL_WIDTH)
  const handleOverflowMenuBreakpoint = () => {
    responsiveToolbar(overflowMenuBreakpoint)
  }
  handleOverflowMenuBreakpoint()
  overflowMenuBreakpoint.changed.listen(handleOverflowMenuBreakpoint)

  // overflow menu
  document.querySelector("#overflow-menu-button").onclick = () =>
    toggleOverflowMenu()
}

const responsiveToolbar = (overflowMenuBreakpoint) => {
  // close all tooltips in case opened
  hideTooltip(document.querySelector("#eventsource-indicator"))
  hideTooltip(document.querySelector("#execution-indicator"))
  // close settings box in case opened
  deactivateToolbarSection(document.querySelector("#settings"))

  if (overflowMenuBreakpoint.isBelow()) {
    enableOverflow()
  } else {
    disableOverflow()
  }
}

let moves = []

const enableOverflow = () => {
  // move elements from toolbar to overflow menu
  const responsiveToolbarElements = document.querySelectorAll(
    "[data-responsive-toolbar-element]",
  )
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

  document
    .querySelector("#toolbar")
    .setAttribute("data-overflow-menu-enabled", "")
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

  document
    .querySelector("#toolbar")
    .removeAttribute("data-overflow-menu-enabled")
  forceHideElement(document.querySelector("#overflow-menu-button"))
}

const toggleOverflowMenu = () => {
  if (overflowMenuIsVisible()) {
    hideOverflowMenu()
  } else {
    showOverflowMenu()
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
