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
let serviceWorkerUnavailabilityReason
if (!serviceWorkerAPI) {
  serviceWorkerUnavailabilityReason = "api_not_found_on_navigator"
} else if (document.location.protocol !== "https:") {
  serviceWorkerUnavailabilityReason = "protocol_must_be_https"
}

export const canUseServiceWorkers = !serviceWorkerUnavailabilityReason

const NOTHING = 0
const REGISTERING = 1
const INSTALLING = 2
const INSTALLED = 3
const ACTIVATING = 4
const ACTIVATED = 5

const readyStateFromServiceWorker = (serviceWorker) => {
  return {
    installing: INSTALLING,
    installed: INSTALLED,
    activating: ACTIVATING,
    activated: ACTIVATED,
  }[serviceWorker.state]
}

export const createServiceWorkerScript = ({
  logsEnabled = false,
  autoReloadWhenUpdateActivates = true,
  autoUnregisterOnError = true,
} = {}) => {
  const log = (...args) => {
    if (logsEnabled) {
      console.log(...args)
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

  const effects = new Set()
  const triggerEffects = () => {
    effects.forEach((effect) => {
      effect(script)
    })
  }
  const onReadyStateChange = (newValue) => {
    script.readyState = newValue
    triggerEffects()
  }
  const onError = (error) => {
    script.error = error
    triggerEffects()
  }

  const script = {
    readyState: NOTHING,
    error: null,
    addEffect: (effect) => {
      effects.add(effect)
      effect(script)
      return () => {
        effects.delete(effect)
      }
    },
    setRegisterPromise: async (promise) => {
      if (document.location.protocol !== "https:") {
        console.warn(
          `service worker will be registered but navigator won't use it because protocol is not https`,
        )
      }
      if (registerPromise) {
        throw new Error(`setRegisterPromise() already called`)
      }
      registerPromise = promise
      let unregisterCalled = false
      unregisterRef.current = () => {
        unregisterCalled = true
      }
      log(`registering service worker`)
      onReadyStateChange(REGISTERING)
      try {
        const registration = await promise
        const { installing, waiting, active } = registration
        if (installing) {
          serviceWorker = installing
        } else if (waiting) {
          serviceWorker = waiting
        } else {
          serviceWorker = active
        }
        onReadyStateChange(readyStateFromServiceWorker(serviceWorker))
        listenEvent(serviceWorker, "statechange", () => {
          onReadyStateChange(readyStateFromServiceWorker(serviceWorker))
        })
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
      } catch (e) {
        console.error(`error while registering service worker script`)
        onError(e)
      }
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
  }

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

    // https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorker/state
    const removeStateChangeListener = listenEvent(
      serviceWorkerUpdate,
      "statechange",
      () => {
        applyStateEffect()
      },
    )
    const applyStateEffect = () => {
      if (serviceWorkerUpdate.state === "activating") {
        serviceWorker = serviceWorkerUpdate
        serviceWorkerUpdate = null
      }
      if (serviceWorkerUpdate.state === "activated") {
        removeStateChangeListener()
      }
      const message = {
        installing: `a new version of the service worker script is installing`,
        installed: `a new version of the service worker script is installed (waiting to activate)`,
        activating: `a new version of the service worker script is activating`,
        activated: `a new version of the service worker script is activated`,
      }[serviceWorkerUpdate.state]
      log(message)
      update.status = serviceWorkerUpdate.state
      triggerUpdateEffects()
    }
    applyStateEffect()
  }

  const updateEffects = new Set()
  const triggerUpdateEffects = () => {
    updateEffects.forEach((updateEffect) => {
      updateEffect(update)
    })
  }
  const onUpdateReadyStateChange = (newValue) => {
    update.readyState = newValue
    triggerUpdateEffects()
  }
  const onUpdateError = (error) => {
    update.error = error
    triggerUpdateEffects()
  }

  const update = {
    readyState: NOTHING,
    error: null,
    addEffect: (updateEffect) => {
      updateEffects.add(updateEffect)
      updateEffect(update)
      return () => {
        effects.delete(updateEffect)
      }
    },
    check: async () => {
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
        onUpdateReadyStateChange(REGISTERING)
        const updateRegistration = await registration.update()
        const { installing, waiting } = updateRegistration
        if (installing || waiting) {
          onUpdateAvailable(installing || waiting)
          return true
        }
        log("no update found")
        return false
      } catch (e) {
        console.error(`error while updating service worker script`)
        if (autoUnregisterOnError) {
          registration.unregister()
        }
        onUpdateError(e)
        return false
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
    activate: (serviceWorkerUpdate) => {
      if (!serviceWorkerUpdate) {
        console.warn(
          `there is no update available on the service worker script`,
        )
        return
      }
      if (serviceWorkerUpdate.status !== "installed") {
        console.warn(
          `service worker script state must be "installed", it is "${serviceWorkerUpdate.state}"`,
        )
        return
      }
      sendMessageUsingChannel(serviceWorkerUpdate, {
        action: "skipWaiting",
      })
    },
  }

  script.update = update
  if (autoReloadWhenUpdateActivates) {
    listenEvent(serviceWorkerAPI, "controllerchange", reload)
  }

  return script
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
