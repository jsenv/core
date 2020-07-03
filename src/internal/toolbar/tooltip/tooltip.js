export const toggleTooltip = (element) => {
  if (element.hasAttribute("data-tooltip-visible")) {
    hideTooltip(element)
  } else {
    showTooltip(element)
  }
}

export const hideTooltip = (element) => {
  element.removeAttribute("data-tooltip-visible")
  element.removeAttribute("data-tooltip-auto-visible")
}

export const showTooltip = (element) => {
  element.setAttribute("data-tooltip-visible", "")
}

export const autoShowTooltip = (element) => {
  element.setAttribute("data-tooltip-auto-visible", "")
}

export const removeAutoShowTooltip = (element) => {
  element.removeAttribute("data-tooltip-auto-visible")
}
