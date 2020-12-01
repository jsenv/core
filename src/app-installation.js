/**
 * listenDisplayMode can be used to know the current displayMode of
 * our web page. It can be "standalone" or "browser-tab".
 *
 */

export const listenDisplayMode = (callback) => {
  const checkDisplayMode = () => {
    const displayModeIsStandalone =
      window.navigator.standalone || window.matchMedia("(display-mode: standalone)").matches
    callback(displayModeIsStandalone ? "standalone" : "browser tab")
  }
  checkDisplayMode()

  window.matchMedia("(display-mode: standalone)").addListener(() => {
    checkDisplayMode()
  })
}

// listenDisplayMode((displayMode) => {
//   document.querySelector("#display-mode").innerHTML = displayMode
// })

export const listenInstallPromptAvailable = (callback) => {
  window.addEventListener("beforeinstallprompt", (beforeinstallpromptEvent) => {
    const prompt = async () => {
      beforeinstallpromptEvent.prompt()
      const choiceResult = await beforeinstallpromptEvent.userChoice
      if (choiceResult.outcome === "accepted") {
        beforeinstallpromptEvent = undefined
        return true
      }
      return false
    }
    callback({ prompt })
  })
}

// listenInstallPromptAvailable(({ prompt }) => {
//   document.querySelector("#install").disabled = false
//   document.querySelector("#install").onclick = async () => {
//     const accepted = await prompt()
//     if (accepted) {
//       document.querySelector("#install").disabled = true
//     }
//   }
// })

/**
 * - User can decide by himself to install the application from the browser toolbar.
 * - Or application code is allowed to prompt user to do so on a user interaction such
 * as after clicking on a button.
 * In these scenarios when user clicks install on that prompt displayed by the browser,
 * browser dispatch an "appinstalled" event.
 */

export const listenAppInstalled = (callback) => {
  window.addEventListener("appinstalled", callback)
  return () => {
    window.removeEventListener("appinstalled", callback)
  }
}

// listenAppInstalled(() => {
//   document.querySelector("#install").disabled = true
// })
