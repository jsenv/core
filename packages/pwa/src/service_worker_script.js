import { createSignal } from "./internal/createSignal.js"
import { listenEvent } from "./internal/listenEvent.js"
import { sendMessageUsingChannel } from "./internal/sendMessageUsingChannel.js"

const serviceWorkerAPI = window.navigator.serviceWorker
export const canUseServiceWorkers =
  Boolean(serviceWorkerAPI) && document.location.protocol === "https:"

export const createServiceWorkerScript = ({
  logsEnabled = false,
  autoReloadAfterUpdate = true,
} = {}) => {
  const log = (...args) => {
    if (logsEnabled) {
      console.log(...args)
    }
  }
  if (!canUseServiceWorkers) {
    return {
      hasRegistered: () => false,
      setRegistrationPromise: () => {},
      unregister: () => {},
      sendMessage: () => {},
      getUpdate: () => null,
      listenUpdateChange: () => {},
      checkForUpdate: () => {},
    }
  }

  /*
   * The current service worker used by the browser
   * As soon as a service worker is found (installing, waiting, activating or activated)
   * serviceWorker is stored to be able to communicate with it for instance
   *
   * For the record, as soon as a new version of the service worker starts to activate
   * browser kills the old service worker
   */
  let registered = null
  const registeredSetter = (worker) => {
    registered = worker
  }
  // https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration
  let registrationPromise = null
  const unregisterRef = { current: () => {} }

  // An updating service worker
  let updating = null
  const updatingSignal = createSignal()
  const updatingSetter = (worker) => {
    if (updating && updating === worker) {
      // we already know about this worker, no need to listen state changes.
      // it happens for manual updates where we bot detect it
      // from registration.update() return value
      // and "updatefound" event
      log("we already know this service worker is updating")
      return
    }
    if (worker) {
      log(`found a worker updating (worker state is: ${worker.state})`)
    } else {
      log(`set update to null`)
    }
    updating = worker
    updatingSignal.emit()
  }

  if (autoReloadAfterUpdate) {
    listenEvent(serviceWorkerAPI, "controllerchange", reload)
  }

  return {
    hasRegistered: () => {
      return Boolean(registrationPromise)
    },
    setRegistrationPromise: async (promise) => {
      if (registered) {
        throw new Error(`setRegistrationPromise already called`)
      }
      let unregisterCalled = false
      unregisterRef.current = () => {
        unregisterCalled = true
      }
      registrationPromise = promise
      const registration = await registrationPromise
      const { installing, waiting, active } = registration
      registeredSetter(installing || waiting || active)
      const removeUpdateFoundListener = listenEvent(
        registration,
        "updatefound",
        () => {
          log("browser notifies use an worker is installing")
          if (registration.installing === installing) {
            log(`it's not an worker update, it's first time worker registers`)
            return
          }
          updatingSetter(registration.installing)
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
    unregister: () => {
      registeredSetter(null)
      updatingSetter(null)
      registrationPromise = null
      unregisterRef.current()
    },
    sendMessage: (message) => {
      if (!registered) {
        console.warn(`no service worker script to send message to`)
        return undefined
      }
      return sendMessageUsingChannel(registered, message)
    },

    getUpdate: () => {
      if (!updating) {
        return null
      }
      const sendMessage = (message) => {
        if (!updating) {
          console.warn(
            `ignore sendMessage call because service worker script is no longer updating`,
          )
          return undefined
        }
        return sendMessageUsingChannel(updating, message)
      }

      return {
        shouldBecomeNavigatorController:
          serviceWorkerAPI.controller === updating,
        navigatorWillReload: autoReloadAfterUpdate,
        sendMessage,
        activate: async ({
          onActivating = () => {},
          onActivated = () => {},
          onBecomesNavigatorController = () => {},
        } = {}) => {
          const { state } = updating
          const waitUntilActivated = () => {
            return new Promise((resolve) => {
              const removeStateChangeListener = listenEvent(
                updating,
                "statechange",
                () => {
                  if (updating.state === "activating") {
                    registeredSetter(updating)
                    onActivating()
                  }
                  if (updating.state === "activated") {
                    registeredSetter(updating)
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
              sendMessage({ action: "skipWaiting" })
            }
            if (state === "activating") {
              registeredSetter(updating)
            }
            await waitUntilActivated()

            if (serviceWorkerAPI.controller === registered) {
              const removeControllerChangeListener = listenEvent(
                serviceWorkerAPI,
                "controllerchange",
                () => {
                  removeControllerChangeListener()
                  onBecomesNavigatorController()
                },
              )
            }
            updatingSetter(null)
            if (autoReloadAfterUpdate) {
              reload()
            }
            return
          }

          registeredSetter(updating)
          onBecomesNavigatorController()
          updatingSetter(null)
          if (autoReloadAfterUpdate) {
            reload()
          }
        },
      }
    },
    listenUpdateChange: (callback) => {
      return updatingSignal.listen(callback)
    },
    checkForUpdate: async () => {
      if (!registrationPromise) {
        console.warn(
          `"setRegistrationPromise" must be called before "checkForUpdate"`,
        )
        return false
      }
      const registration = await registrationPromise
      // await for the registration promise above can take some time
      // especially when the service worker is installing for the first time
      // because it is fetching a lot of urls to put into cache.
      // In that scenario we might want to display something different ?
      // Without this, UI seems to take ages to check for an update
      try {
        const updateRegistration = await registration.update()
        const { installing } = updateRegistration
        if (installing) {
          log("a service worker script is installing")
          updatingSetter(installing)
          return true
        }
        const { waiting } = updateRegistration
        if (waiting) {
          log("a service worker script is waiting to activate")
          updatingSetter(waiting)
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
