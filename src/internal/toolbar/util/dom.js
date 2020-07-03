export const forceHideElement = (element) => {
  element.setAttribute("data-force-hide", "")
}

export const removeForceHideElement = (element) => {
  element.removeAttribute("data-force-hide")
}

export const setStyles = (element, styles) => {
  const elementStyle = element.style
  const restoreStyles = Object.keys(styles).map((styleName) => {
    let restore
    if (styleName in elementStyle) {
      const currentStyle = elementStyle[styleName]
      restore = () => {
        elementStyle[styleName] = currentStyle
      }
    } else {
      restore = () => {
        delete elementStyle[styleName]
      }
    }

    elementStyle[styleName] = styles[styleName]

    return restore
  })
  return () => {
    restoreStyles.forEach((restore) => restore())
  }
}

export const setAttributes = (element, attributes) => {
  Object.keys(attributes).forEach((name) => {
    element.setAttribute(name, attributes[name])
  })
}

export const getDocumentScroll = () => {
  return {
    x: document.documentElement.scrollLeft,
    y: document.documentElement.scrollTop,
  }
}

export const toolbarSectionIsActive = (element) => {
  return element.hasAttribute("data-active")
}

export const activateToolbarSection = (element) => {
  element.setAttribute("data-active", "")
}

export const deactivateToolbarSection = (element) => {
  element.removeAttribute("data-active")
}
