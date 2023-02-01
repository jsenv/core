/*
 * Don't forget about the advanced use case where
 * update can be achieved manually
 * (I'll create a custom worker for this capable to update one asset in place)
 * we will need a 5. scenario once update is done
 * but this is likely a message the
 * service worker itself should send to the page
 * to let the page handle what was modified
 * and if page is able to handle that, then we won't reload
 * but this means service worker must send a message to all pages
 * and some pages might need a full reload, some pages might not
 */

import { listenEvent } from "./internal/listenEvent.js"
import { sendMessageUsingChannel } from "./internal/sendMessageUsingChannel.js"

const serviceWorkerAPI = window.navigator.serviceWorker
export const canUseServiceWorkers =
  Boolean(serviceWorkerAPI) && document.location.protocol === "https:"

export const createServiceWorkerScript = ({
  logsEnabled = false,
  autoReloadWhenUpdateActivates = true,
} = {}) => {
  const log = (...args) => {
    if (logsEnabled) {
      console.log(...args)
    }
  }

  if (!canUseServiceWorkers) {
    return {
      setRegisterPromise: () => undefined,
      getServiceWorker: () => null,
      unregister: () => undefined,
      sendMessage: () => undefined,
      addUpdateCallback: () => () => {},
      checkForUpdates: () => false,
    }
  }

  /*
   * The current service worker used by the browser
   * As soon as a service worker update is found (installing, waiting, activating or activated)
   * the serviceWorker object is stored into update.worker and it's possible to communicate with it.
   *
   * For the record, as soon as a new version of the service worker starts to activate
   * browser kills the old service worker
   */
  let serviceWorker = null
  let serviceWorkerUpdate = null
  // https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration
  let registerPromise = null
  const unregisterRef = { current: () => {} }
  const updateCallbacks = new Set()
  // When an update is found UI would display something like this:
  // 1. Nothing (there is no update available)
  // 2. Message like "an update is installing" (update.installing is true)
  //    There is nothing much more to do for now, we'll wait for the update to be installed
  //    and go to 3.
  // 3. Message like "an update is available" + a button to update (would call update.replace())
  //    the button should explain that page will be reloaded
  // 4. Message like "an update is hapenning"
  //    happens during the worker "activate" event until the waitUntil resolves
  //    the ui should not give any means to act but just inform about this
  //    maybe the message could add something like "... page will reload once update is done"
  const onUpdateAvailable = (serviceWorkerCandidate) => {
    if (serviceWorkerCandidate === serviceWorkerUpdate) {
      // we already know about this worker, no need to listen state changes.
      // Happens when code is notified both from
      // registration.update() and "updatefound" event
      // Which happens for manual updates (calls to registration.update())
      log("we are already aware of this service worker update")
      return
    }
    serviceWorkerUpdate = serviceWorkerCandidate

    const sendMessage = async (message) => {
      if (!serviceWorkerUpdate) {
        console.warn(
          `Ignoring call to update.sendMessage because there is no service worker script updating to communicate with`,
        )
        return undefined
      }
      return sendMessageUsingChannel(serviceWorkerUpdate, message)
    }
    const activate = (serviceWorkerUpdate) => {
      if (!serviceWorkerUpdate) {
        console.warn(
          `there is no update available on the service worker script`,
        )
        return
      }
      if (serviceWorkerUpdate.state !== "installed") {
        console.warn(
          `service worker script state must be "installed", it is "${serviceWorkerUpdate.state}"`,
        )
      }
      sendMessageUsingChannel(serviceWorkerUpdate, {
        action: "skipWaiting",
      })
    }
    // https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorker/state
    const onInstalling = () => {
      const update = {
        installing: true,
        installed: false,
        activating: false,
        activated: false,
        sendMessage,
        activate,
      }
      updateCallbacks.forEach((updateCallback) => {
        updateCallback(update)
      })
      const removeStateChangeListener = listenEvent(
        serviceWorkerUpdate,
        "statechange",
        () => {
          if (serviceWorkerUpdate.state === "installed") {
            removeStateChangeListener()
            onInstalled()
          }
        },
      )
    }
    const onInstalled = () => {
      const update = {
        installing: false,
        installed: true,
        activating: false,
        activated: false,
        sendMessage,
        activate,
      }
      updateCallbacks.forEach((updateCallback) => {
        updateCallback(update)
      })
      const removeStateChangeListener = listenEvent(
        serviceWorkerUpdate,
        "statechange",
        () => {
          if (serviceWorkerUpdate.state === "activating") {
            removeStateChangeListener()
            onActivating()
          }
        },
      )
    }
    const onActivating = () => {
      const update = {
        installing: false,
        installed: true,
        activating: true,
        activated: false,
        sendMessage,
        activate,
      }
      serviceWorker = serviceWorkerUpdate
      serviceWorkerUpdate = null
      updateCallbacks.forEach((updateCallback) => {
        updateCallback(update)
      })
      const removeStateChangeListener = listenEvent(
        serviceWorkerUpdate,
        "statechange",
        () => {
          if (serviceWorkerUpdate.state === "activated") {
            removeStateChangeListener()
            onActivated()
          }
        },
      )
    }
    const onActivated = () => {
      const update = {
        installing: false,
        installed: true,
        activating: false,
        activated: true,
        sendMessage,
        activate,
      }
      updateCallbacks.forEach((updateCallback) => {
        updateCallback(update)
      })
    }

    if (serviceWorkerUpdate.state === "installing") {
      log(`a new version of the service worker script is installing`)
      onInstalling()
      return
    }
    if (serviceWorkerUpdate.state === "installed") {
      log(
        `a new version of the service worker script is waiting to be activated`,
      )
      onInstalled()
      return
    }
    if (serviceWorkerUpdate.state === "activating") {
      log(`a new version of the service worker script is activating`)
      onActivating()
      return
    }
    if (serviceWorkerUpdate.state === "activated") {
      serviceWorker = serviceWorkerUpdate
      serviceWorkerUpdate = null
      log(`a new version of the service worker script is activated`)
      onActivated()
      return
    }
    throw new Error(
      `unexpected serviceWorker state ${serviceWorkerUpdate.state}`,
    )
  }

  if (autoReloadWhenUpdateActivates) {
    listenEvent(serviceWorkerAPI, "controllerchange", reload)
  }

  return {
    setRegisterPromise: async (promise) => {
      if (registerPromise) {
        throw new Error(`setRegisterPromise() already called`)
      }
      registerPromise = promise
      let unregisterCalled = false
      unregisterRef.current = () => {
        unregisterCalled = true
      }
      const registration = await promise
      const { installing, waiting, active } = registration
      if (installing) {
        serviceWorker = installing
      } else if (waiting) {
        serviceWorker = waiting
      } else {
        serviceWorker = active
      }
      const removeUpdateFoundListener = listenEvent(
        registration,
        "updatefound",
        () => {
          onUpdateAvailable(registration.installing)
        },
      )
      if (unregisterCalled) {
        registration.unregister()
        removeUpdateFoundListener()
      } else {
        unregisterRef.current = () => {
          registration.unregister()
          removeUpdateFoundListener()
        }
      }
    },
    getServiceWorker: async () => {
      if (!serviceWorker) {
        await registerPromise
      }
      return serviceWorker
    },
    unregister: () => {
      return unregisterRef.current()
    },
    sendMessage: async (message) => {
      if (!registerPromise) {
        console.warn(
          `Ignoring call to sendMessage because there is no service worker script to communicate with (setRegisterPromise not called?)`,
        )
        return undefined
      }
      if (!serviceWorker) {
        await registerPromise
      }
      return sendMessageUsingChannel(serviceWorker, message)
    },
    addUpdateCallback: (updateCallback) => {
      updateCallbacks.add(updateCallback)
      return () => {
        updateCallbacks.delete(updateCallback)
      }
    },
    checkForUpdates: async () => {
      if (!registerPromise) {
        console.warn(
          `"setRegisterPromise" must be called before "update.check()"`,
        )
        return false
      }
      const registration = await registerPromise
      log(
        "calling registration.update() to ask browser to check if there is an update on that service worker script",
      )
      // await for the registration promise above can take some time
      // especially when the service worker is installing for the first time
      // because it is fetching a lot of urls to put into cache.
      // In that scenario we might want to display something different ?
      // Without this, UI seems to take ages to check for an update
      try {
        const updateRegistration = await registration.update()
        const { installing, waiting } = updateRegistration
        if (installing || waiting) {
          onUpdateAvailable(installing || waiting)
          return true
        }
        log("no update found")
        return false
      } catch (e) {
        log(
          `error while updating service worker script. Script will be unregistered.
--- error stack ---
${e.stack}`,
        )
        registration.unregister()
        return false
      }
    },
  }
}

let refreshing = false
const reload = () => {
  if (refreshing) {
    return
  }
  refreshing = true
  window.location.reload()
}

// const navigatorIsControlledByAServiceWorker = () => {
//   return canUseServiceWorker ? Boolean(serviceWorkerAPI.controller) : false
// }

// const getServiceWorkerControllingNavigator = () => {
//   return navigatorIsControlledByAServiceWorker() ? serviceWorkerAPI.controller : null
// }
