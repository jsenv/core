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
