import { listenEvent } from "./internal/listenEvent.js"
import { sendMessageUsingChannel } from "./internal/sendMessageUsingChannel.js"

const serviceWorkerAPI = window.navigator.serviceWorker
export const canUseServiceWorkers =
  Boolean(serviceWorkerAPI) && document.location.protocol === "https:"

export const createServiceWorkerScript = ({
  logsEnabled = false,
  autoReloadAfterUpdateActivation = false,
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
  const onUpdateAvailable = (serviceWorkerCandidate) => {
    if (serviceWorkerCandidate === serviceWorkerUpdate) {
      // we already know about this worker, no need to listen state changes.
      // Happens when code is notified both from
      // registration.update() and "updatefound" event
      // Which happens for manual updates (calls to registration.update())
      log("we are already aware of this service worker update")
      return
    }
    if (serviceWorkerCandidate.state === "installing") {
      log(`a new version of the service worker script is installing`)
    } else if (serviceWorkerCandidate.state === "waiting") {
      log(
        `a new version of the service worker script is waiting to be activated`,
      )
    }

    serviceWorkerUpdate = serviceWorkerCandidate
    const udpateInterface = {
      activate: async ({
        onActivating = () => {},
        onActivated = () => {},
        onBecomesNavigatorController = () => {},
      } = {}) => {
        if (!serviceWorkerUpdate) {
          console.warn(
            `Ignoring call to update.activate because there is no update available on the service worker script`,
          )
          return
        }
        const { state } = serviceWorkerUpdate
        const waitUntilActivated = () => {
          return new Promise((resolve) => {
            const removeStateChangeListener = listenEvent(
              serviceWorkerUpdate,
              "statechange",
              () => {
                if (serviceWorkerUpdate.state === "activating") {
                  serviceWorker = serviceWorkerUpdate
                  onActivating()
                }
                if (serviceWorkerUpdate.state === "activated") {
                  serviceWorker = serviceWorkerUpdate
                  onActivated()
                  removeStateChangeListener()
                  resolve()
                }
              },
            )
          })
        }

        // worker must be waiting (meaning state must be "installed")
        // to be able to call skipWaiting on it.
        // If it's installing it's an error.
        // If it's activating, we'll just skip the skipWaiting call
        // If it's activated, we'll just return early
        if (state === "installed" || state === "activating") {
          if (state === "installed") {
            sendMessageUsingChannel(serviceWorkerUpdate, {
              action: "skipWaiting",
            })
          }
          if (state === "activating") {
            serviceWorker = serviceWorkerUpdate
          }
          await waitUntilActivated()

          if (serviceWorkerAPI.controller === serviceWorker) {
            const removeControllerChangeListener = listenEvent(
              serviceWorkerAPI,
              "controllerchange",
              () => {
                removeControllerChangeListener()
                onBecomesNavigatorController()
              },
            )
          }
          serviceWorkerUpdate = null
          if (autoReloadAfterUpdateActivation) {
            reload()
          }
          return
        }

        serviceWorker = serviceWorkerUpdate
        serviceWorkerUpdate = null
        onBecomesNavigatorController()
        if (autoReloadAfterUpdateActivation) {
          reload()
        }
      },
      sendMessage: async (message) => {
        if (!serviceWorkerUpdate) {
          console.warn(
            `Ignoring call to update.sendMessage because there is no service worker script updating to communicate with`,
          )
          return undefined
        }
        return sendMessageUsingChannel(serviceWorkerUpdate, message)
      },
    }
    updateCallbacks.forEach((updateCallback) => {
      updateCallback(udpateInterface)
    })
  }

  if (autoReloadAfterUpdateActivation) {
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
