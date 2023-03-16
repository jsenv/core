/**
  The following scenario is working:

  - user click install button -> browser shows add to home screen prompt
  - user click cancel on browser prompt
  - user click again install button -> browser shows again add to home screen prompt

  It's very easy to break this so that subsequent click does nothing.
  Nothing means browser always returns a "dimissed" user choice without asking user.
  I suspect chrome is trying to prevent malicious script to annoy user
  by calling prompt() many times.

  It's currently working because we don't hide beforeinstallpromptEvent behind a function.
  It would be hidden behind a function if we put it into react state or
  just by using a curried funciton like:

  beforeinstallpromptEvent
  const curriedFunction = () => {
    beforeinstallpromptEvent.prompt()
  }

  If we do so, chrome will always dismiss subsequent click on install button. (until page is reloaded).
  To avoid that we store the event on window.beforeinstallpromptEvent.
*/

import { sigref } from "@jsenv/sigi"

import { listenEvent } from "./internal/listenEvent.js"
import { listenAppInstalled } from "./listen_app_installed.js"
import { displayModeStandaloneRef } from "./display_mode_standalone_ref.js"

let appInstalledEvent = false

const listenBeforeInstallPrompt = (callback) =>
  listenEvent(window, "beforeinstallprompt", callback)

const isAvailable = () => {
  if (!window.beforeinstallpromptEvent) {
    return false
  }
  if (displayModeStandaloneRef.value) {
    return false
  }
  if (appInstalledEvent) {
    return false
  }
  return true
}
const [availableRef, availableSetter] = sigref(isAvailable())
const checkAvailabilityChange = () => {
  availableSetter(isAvailable())
}

listenAppInstalled(() => {
  // prompt "becomes" unavailable if user installs app
  // it can happen if user installs app manually from browser toolbar
  // in that case there is no point showing the install
  // button in the ui
  appInstalledEvent = true
  checkAvailabilityChange()
})
listenBeforeInstallPrompt((beforeinstallpromptEvent) => {
  window.beforeinstallpromptEvent = beforeinstallpromptEvent
  checkAvailabilityChange()
})
displayModeStandaloneRef.subscribe(() => {
  checkAvailabilityChange()
})

export const addToHomescreen = {
  availableRef,
  prompt: async () => {
    if (!window.beforeinstallpromptEvent) {
      console.warn(
        `cannot prompt add to home screen: window.beforeinstallpromptEvent is missing`,
      )
      return false
    }
    window.beforeinstallpromptEvent.prompt()
    const choiceResult = await window.beforeinstallpromptEvent.userChoice
    if (choiceResult.outcome === "accepted") {
      return true
    }
    return false
  },
}
