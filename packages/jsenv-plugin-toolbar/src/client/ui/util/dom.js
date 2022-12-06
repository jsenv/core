export const updateIframeOverflowOnParentWindow = () => {
  if (!window.parent) {
    // can happen while parent iframe reloads
    return
  }

  const aTooltipIsOpened =
    document.querySelector("[data-tooltip-visible]") ||
    document.querySelector("[data-tooltip-auto-visible]")
  const settingsAreOpened = document.querySelector("#settings[data-active]")

  if (aTooltipIsOpened || settingsAreOpened) {
    enableIframeOverflowOnParentWindow()
  } else {
    disableIframeOverflowOnParentWindow()
  }
}

let iframeOverflowEnabled = false
const enableIframeOverflowOnParentWindow = () => {
  if (iframeOverflowEnabled) return
  iframeOverflowEnabled = true

  const iframe = getToolbarIframe()
  const transitionDuration = iframe.style.transitionDuration
  setStyles(iframe, { "height": "100%", "transition-duration": "0ms" })
  if (transitionDuration) {
    setTimeout(() => {
      setStyles(iframe, { "transition-duration": transitionDuration })
    })
  }
}

const disableIframeOverflowOnParentWindow = () => {
  if (!iframeOverflowEnabled) return
  iframeOverflowEnabled = false

  const iframe = getToolbarIframe()
  const transitionDuration = iframe.style.transitionDuration
  setStyles(iframe, { "height": "40px", "transition-duration": "0ms" })
  if (transitionDuration) {
    setTimeout(() => {
      setStyles(iframe, { "transition-duration": transitionDuration })
    })
  }
}

export const getToolbarIframe = () => {
  const iframes = Array.from(window.parent.document.querySelectorAll("iframe"))
  return iframes.find((iframe) => iframe.contentWindow === window)
}

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
