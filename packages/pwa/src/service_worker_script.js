/*
 * a mon avis faudra un truc basé sur clients.claim()
 * voir plutot sur clients.matchAll
 * puis client.postMessage pour lui dire hey, est ce que tu est capable
 * de reload
 * puis alors si tout le monde est ok clients.claim()
 * sinon client.reload
 *
 * Bon a réfléchir
 *
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
  const readyState = {
    installing: INSTALLING,
    installed: INSTALLED,
    activating: ACTIVATING,
    activated: ACTIVATED,
    // redundant happens on chrome when:
    // 1. in case of install failure the script state will move to redundant
    //    when reloading the page on chrome (if update on reload is checked)
    // 2. Manually unregister from devtools
    redundant: NOTHING,
  }[serviceWorker.state]
  return readyState
}

export const createServiceWorkerScript = ({
  logsEnabled = false,
  autoReloadWhenUpdateActivates = false,
  autoUnregisterOnError = false,
} = {}) => {
  // on devrait prendre le navigator.serviceWorker.controller au démarrage et considérer que c'est l'état
  // de départ au lieu de NOTHING

  const logger = {
    debug: logsEnabled
      ? (...args) => console.debug(...prefixArgs(...args))
      : () => {},
    info: logsEnabled
      ? (...args) => console.info(...prefixArgs(...args))
      : () => {},
    warn: logsEnabled
      ? (...args) => console.warn(...prefixArgs(...args))
      : () => {},
    error: logsEnabled
      ? (...args) => console.error(...prefixArgs(...args))
      : () => {},
    log: logsEnabled
      ? (...args) => console.log(...prefixArgs(...args))
      : () => {},
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
  let registrationPromise = null
  let unregisterCalled = false

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

  let removeStateChangeListener = () => {}
  let removeUpdateFoundListener = () => {}

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
        logger.warn(
          `script will be registered but navigator won't use it because protocol is not https`,
        )
      }
      if (registerPromise) {
        throw new Error(`setRegisterPromise() already called`)
      }
      registerPromise = promise
      registrationPromise = promise
      logger.info(`registering`)
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

        if (unregisterCalled) {
          unregisterCalled = false
          script.unregister()
          return
        }

        removeStateChangeListener = listenEvent(
          serviceWorker,
          "statechange",
          () => {
            applyStateEffect()
          },
        )
        removeUpdateFoundListener = listenEvent(
          registration,
          "updatefound",
          () => {
            if (registration.installing === serviceWorker) {
              // browser consider first install as an update...
              return
            }
            onUpdateAvailable(registration.installing)
          },
        )
        const applyStateEffect = () => {
          const message = {
            installing: `installing`,
            installed: `installed (waiting to activate)`,
            activating: `activating`,
            activated: `activated`,
            redundant: `unregistered by navigator`,
          }[serviceWorker.state]
          logger.info(message)
          onReadyStateChange(readyStateFromServiceWorker(serviceWorker))
          if (serviceWorker.state === "redundant") {
            removeStateChangeListener()
            removeUpdateFoundListener()
            serviceWorker = null
            registerPromise = null
            registrationPromise = null
          }
        }
        applyStateEffect()
      } catch (e) {
        logger.error(`registration error`)
        onError(e)
      }
    },
    unregister: async () => {
      if (script.readyState === REGISTERING) {
        logger.debug("set unregisterCalled to true to unregister asap")
        unregisterCalled = true
        return
      }
      if (registrationPromise) {
        logger.info("unregistering")
        removeStateChangeListener()
        removeStateChangeListener = () => {}
        removeUpdateFoundListener()
        removeUpdateFoundListener = () => {}
        serviceWorker = null
        serviceWorkerUpdate = null
        const registration = await registrationPromise
        await registration.unregister()
        registerPromise = null
        registrationPromise = null
        logger.info("unregistered")
        onReadyStateChange(NOTHING)
      }
    },
    sendMessage: async (message) => {
      if (script.readyState === NOTHING) {
        logger.warn(
          `Ignoring call to sendMessage because there is no registered script to communicate with`,
        )
        return undefined
      }
      if (script.readyState === REGISTERING) {
        await registrationPromise
      }
      return sendMessageUsingChannel(serviceWorker, message)
    },
  }
  if (serviceWorkerAPI.controller) {
    // ça pose pas un souci si le site ne fait pas le call a register?
    // est ce que chrome part alors du principe qu'on utilise plus le service worker
    script.readyState = readyStateFromServiceWorker(serviceWorkerAPI.controller)
    registrationPromise = serviceWorkerAPI.ready
  }

  const onUpdateAvailable = (serviceWorkerCandidate) => {
    if (serviceWorkerCandidate === serviceWorkerUpdate) {
      // we already know about this worker, no need to listen state changes.
      // Happens when code is notified both from
      // registration.update() and "updatefound" event
      // Which happens for manual updates (calls to registration.update())
      logger.debug("we are already aware of this service worker update")
      return
    }
    serviceWorkerUpdate = serviceWorkerCandidate

    // https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorker/state
    const removeStateChangeListener = listenEvent(
      serviceWorkerUpdate,
      "statechange",
      () => {
        applyUpdateStateEffect()
      },
    )
    const applyUpdateStateEffect = () => {
      const message = {
        installing: `update is installing in parallel`,
        installed: `update installed (waiting to activate and replace current version)`,
        activating: `update is activating (navigator has killed the current version)`,
        activated: `update is activated (navigator is using the updated version)`,
      }[serviceWorkerUpdate.state]
      logger.info(message)
      update.status = serviceWorkerUpdate.state
      if (serviceWorkerUpdate.state === "activating") {
        serviceWorker = serviceWorkerUpdate
      }
      if (serviceWorkerUpdate.state === "activated") {
        removeStateChangeListener()
        serviceWorkerUpdate = null
      }
      triggerUpdateEffects()
    }
    applyUpdateStateEffect()
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
      if (script.readyState === 0) {
        logger.warn(`cannot check for an update, there is no script registered`)
        return false
      }
      const registration = await registrationPromise
      logger.info(
        "call registration.update() (navigator will check if there is an update)",
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
        logger.info("no update found")
        onUpdateReadyStateChange(NOTHING)
        return false
      } catch (e) {
        if (autoUnregisterOnError) {
          registration.unregister()
        }
        logger.error(`error while updating script`)
        onUpdateError(e)
        return false
      }
    },
    sendMessage: async (message) => {
      if (!serviceWorkerUpdate || serviceWorkerUpdate.state === "activating") {
        logger.warn(`no updated version to communicate with`)
        return undefined
      }
      return sendMessageUsingChannel(serviceWorkerUpdate, message)
    },
    activate: (serviceWorkerUpdate) => {
      if (!serviceWorkerUpdate) {
        logger.warn(`no updated version to activate`)
        return
      }
      if (serviceWorkerUpdate.readyState !== INSTALLED) {
        console.warn(
          `updated version is not ready to activate (readyState is "${serviceWorkerUpdate.readyState}")`,
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

const prefixArgs = (...args) => {
  return [
    `%csw script`,
    `background: green; color: black; padding: 1px 3px; margin: 0 1px`,
    ...args,
  ]
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
