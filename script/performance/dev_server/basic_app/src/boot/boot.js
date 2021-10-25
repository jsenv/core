/*
 * This file is inlined in the HTML file by [data-jsenv-force-inline]
 * Responsabilities:
 * - inject the dev ribbon in development mode
 * - Dynamic import of "app_loader.js" (fetch+parse+execute)
 *   - Catch error during the dynamic import
 *   - Display splashscreen during this dynamic import
 * - Call loadApp exported by "app_loader.js"
 *   - Provide an updateSplashscreenText
 *   - Hide splashscreen once app is ready to be displayed
 */

// eslint-disable-next-line import/no-unresolved
import { DEV } from "#env"

if (DEV) {
  const { injectDevRibbon } = await import("./dev_ribbon.js")
  injectDevRibbon()
}

// When it take more than "BOOTING_SLOW"ms for loadApp to resolve or call updateSplashscreenText
// -> splashscreen displays <div id="booting_is_slow"> content
const BOOTING_SLOW = 2500
// When it takes less than "SPLASHIN_DELAY"ms for loadApp to resolve
// -> we won't even show the splashscreen (happens on user second visit because everything is in browser cache)
const SPLASHIN_DELAY = 3000
// When less than "SPLASHOUT_MIN_INTERVAL"ms have ellapsed since splashin animation started
// -> code ensures "SPLASHOUT_MIN_INTERVAL"ms ellapses before playing the splashout animation
// This is to prevent a disturbing blink when loadApp resolves shortly after splashin animation
const SPLASHOUT_MIN_INTERVAL = 1650

const appNode = document.querySelector("#app")
const splashscreenNode = document.querySelector("#splashscreen")

const BOOTING_START = "booting_start"
const BOOTING_IS_SLOW = "booting_is_slow"
const BOOTING_ERROR = "booting_error"

const boot = async () => {
  if (DEV) {
    performance.measure(`booting app`)
  }

  const bootStartMs = Date.now()

  let splashIsVisible = false
  const splashin = () => {
    splashscreenNode.setAttribute("data-splashin", "")
    splashIsVisible = true
  }

  const splashout = async () => {
    splashscreenNode.setAttribute("data-splashout", "")
    await new Promise((resolve) => {
      setTimeout(() => {
        splashIsVisible = false
        resolve()
      }, 300)
    })
  }

  const killSplashscreen = () => {
    // Here splashscreen is "killed" with display: 'none' but it could also
    // be removed from the DOM
    splashscreenNode.style.display = "none"
    splashIsVisible = false
    if (DEV) {
      performance.measure(`app displayed`)
    }
  }

  const splashInTimeout = setTimeout(splashin, SPLASHIN_DELAY)

  const bootingIsSlowTimeout = setTimeout(() => {
    setBootingState(BOOTING_IS_SLOW)
  }, BOOTING_SLOW)

  try {
    setBootingState(BOOTING_START)
    const { loadApp } = await import("../app_loader/app_loader.js")
    await loadApp({
      updateSplashscreenText: (message) => {
        clearTimeout(bootingIsSlowTimeout)
        const splashscreenMessageNode = document.querySelector(
          "#splashscreen_message",
        )
        splashscreenMessageNode.innerHTML = message
      },
    })

    clearTimeout(splashInTimeout)
    clearTimeout(bootingIsSlowTimeout)

    if (!splashIsVisible) {
      console.log("super fast")
      appNode.removeAttribute("data-booting")
      // app was super fast to load, splashscreen was not even displayed, cool
      killSplashscreen()
      return
    }

    const splashInMs = bootStartMs + SPLASHIN_DELAY
    const msEllapsedSinceSplashIn = Date.now() - splashInMs

    if (msEllapsedSinceSplashIn < SPLASHOUT_MIN_INTERVAL) {
      const msToWaitToPreventBlink =
        SPLASHOUT_MIN_INTERVAL - msEllapsedSinceSplashIn
      await new Promise((resolve) => {
        setTimeout(resolve, msToWaitToPreventBlink)
      })
    }

    appNode.removeAttribute("data-booting")
    // Wait the end of the "splashout" animation before killing splashscreen entirely
    await splashout()
    killSplashscreen()
  } catch (error) {
    clearTimeout(bootingIsSlowTimeout)

    setBootingState(BOOTING_ERROR, {
      errorStack:
        error.stack ||
        `<No stack associated with this error> (Check devtools to get more info)`,
    })
    throw error
  }
}

const setBootingState = (nextBootingState, data = {}) => {
  const splashscreenMessageNode = document.querySelector(
    "#splashscreen_message",
  )
  splashscreenMessageNode.innerHTML = ""
  const variantModel = document.querySelector(`#${nextBootingState}`)
  const variantInstance = variantModel.cloneNode(true)

  replaceNodeVariables(variantInstance, data)
  splashscreenMessageNode.appendChild(variantInstance)
}

const replaceNodeVariables = (node, data) => {
  if (node.nodeName === "#text") {
    node.textContent = node.textContent.replace(/\${(\w*)}/g, (_, key) => {
      return data.hasOwnProperty(key) ? data[key] : ""
    })
    return
  }

  Array.from(node.childNodes).forEach((node) => {
    replaceNodeVariables(node, data)
  })
}

if (window.browserIsSupported) {
  await boot()

  const appDisplayedMeasure = performance.measure("app_displayed")
  window.resolveAppDisplayedMetricsPromise({
    appDisplayedDuration: appDisplayedMeasure.duration,
  })
}
