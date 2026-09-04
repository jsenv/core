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

import { computed, signal } from "@preact/signals";

import { displayModeStandaloneSignal } from "./display_mode_standalone_signal.js";
import { listenEvent } from "./internal/listenEvent.js";
import { listenAppInstalled } from "./listen_app_installed.js";

const appInstalledSignal = signal(false);
const beforeInstallPromptSignal = signal(
  Boolean(window.beforeinstallpromptEvent),
);
const availableSignal = computed(() => {
  if (!beforeInstallPromptSignal.value) {
    return false;
  }
  if (displayModeStandaloneSignal.value) {
    return false;
  }
  if (appInstalledSignal.value) {
    return false;
  }
  return true;
});

listenAppInstalled(() => {
  // prompt "becomes" unavailable if user installs app
  // it can happen if user installs app manually from browser toolbar
  // in that case there is no point showing the install
  // button in the ui
  appInstalledSignal.value = true;
});
listenEvent(window, "beforeinstallprompt", (beforeinstallpromptEvent) => {
  window.beforeinstallpromptEvent = beforeinstallpromptEvent;
  beforeInstallPromptSignal.value = true;
});

/**
 * Add to home screen (PWA installation) helper.
 *
 * The page must capture the "beforeinstallprompt" event itself, as early as
 * possible (in a classic inline script, before this module loads), and store
 * it on `window.beforeinstallpromptEvent`:
 *
 *   window.addEventListener("beforeinstallprompt", (event) => {
 *     event.preventDefault();
 *     window.beforeinstallpromptEvent = event;
 *   });
 *
 * - `availableSignal`: reactive signal; `availableSignal.value` is true when
 *   the install prompt can be shown (browser fired "beforeinstallprompt", app
 *   not already installed, not already running standalone).
 *   `availableSignal.subscribe(callback)` calls back immediately and on change.
 * - `prompt()`: async, must be called from a user gesture (e.g. click);
 *   resolves to true if the user accepted installation.
 */
export const addToHomescreen = {
  availableSignal,
  prompt: async () => {
    if (!window.beforeinstallpromptEvent) {
      console.warn(
        `cannot prompt add to home screen: window.beforeinstallpromptEvent is missing`,
      );
      return false;
    }
    window.beforeinstallpromptEvent.prompt();
    const choiceResult = await window.beforeinstallpromptEvent.userChoice;
    if (choiceResult.outcome === "accepted") {
      return true;
    }
    return false;
  },
};
