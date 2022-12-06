import {
  forceHideElement,
  removeForceHideElement,
  deactivateToolbarSection,
} from "../util/dom.js"
import { createHorizontalBreakpoint } from "../util/responsive.js"
import { hideTooltip } from "../tooltips/tooltips.js"

const WINDOW_SMALL_WIDTH = 420

export const initToolbarMenuOverflow = () => {
  // apply responsive design on toolbar icons if needed + add listener on resize screen
  // ideally we should listen breakpoint once, for now restore toolbar
  const overflowMenuBreakpoint = createHorizontalBreakpoint(WINDOW_SMALL_WIDTH)
  const handleOverflowMenuBreakpoint = () => {
    responsiveToolbar(overflowMenuBreakpoint)
  }
  handleOverflowMenuBreakpoint()
  overflowMenuBreakpoint.changed.listen(handleOverflowMenuBreakpoint)

  document.querySelector("#menu_overflow_button").onclick = () => {
    if (overflowMenuIsOpened()) {
      closeOverflowMenu()
    } else {
      openOverflowMenu()
    }
  }
}

const responsiveToolbar = (overflowMenuBreakpoint) => {
  // close all tooltips in case opened
  hideTooltip(document.querySelector("#server_indicator"))
  hideTooltip(document.querySelector("#document_execution_indicator"))
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
  const overflowMenu = document.querySelector("#menu_overflow")

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
    .setAttribute("data-menu-overflow-enabled", "")
  removeForceHideElement(document.querySelector("#menu_overflow_button"))
}

const disableOverflow = () => {
  // close overflow menu in case it's open & unselect toggleOverflowMenu button in case it's selected
  closeOverflowMenu()
  deactivateToolbarSection(document.querySelector("#menu_overflow"))
  moves.forEach(({ element, placeholder }) => {
    placeholder.parentNode.replaceChild(element, placeholder)
  })
  moves = []
  document
    .querySelector("#toolbar")
    .removeAttribute("data-menu-overflow-enabled")
  forceHideElement(document.querySelector("#menu_overflow_button"))
}

const overflowMenuIsOpened = () => {
  const toolbar = document.querySelector("#toolbar")
  return toolbar.hasAttribute("data-menu-overflow-opened")
}

const openOverflowMenu = () => {
  const toolbar = document.querySelector("#toolbar")
  document.querySelector("#menu_overflow").setAttribute("data-animate", "")
  toolbar.setAttribute("data-menu-overflow-opened", "")
}

const closeOverflowMenu = () => {
  const toolbar = document.querySelector("#toolbar")
  toolbar.removeAttribute("data-menu-overflow-opened")
  document.querySelector("#menu_overflow").removeAttribute("data-animate")
}
