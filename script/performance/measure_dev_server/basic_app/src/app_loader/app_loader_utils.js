export const loadCSSAndFonts = async (
  cssUrl,
  { timeout = 1000, onCssReady = () => {}, onFontsReady = () => {} } = {},
) => {
  const loadedPromise = (async () => {
    try {
      await injectCSS(cssUrl)
      onCssReady()
      if (onFontsReady) {
        await document.fonts.ready
        onFontsReady()
      }
    } catch (e) {
      return
    }
  })()
  return Promise.race([
    loadedPromise,
    new Promise((resolve) => {
      setTimeout(resolve, timeout)
    }),
  ])
}

const injectCSS = (cssUrl, { crossOrigin } = {}) => {
  return new Promise((resolve, reject) => {
    const link = document.createElement("link")
    link.rel = "stylesheet"
    link.onload = resolve
    link.onerror = reject
    link.href = cssUrl
    link.crossOrigin = crossOrigin
    document.head.appendChild(link)
  })
}

export const nextIDLEPromise = window.requestIdleCallback
  ? ({ timeout = 60 } = {}) => {
      return new Promise((resolve) => {
        window.requestIdleCallback(resolve, { timeout })
      })
    }
  : () => {
      return new Promise((resolve) => {
        window.requestAnimationFrame(resolve)
      })
    }
