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
  logLevel = "info",
  logBackgroundColor = "green",
  logColor = "black",
  autoReloadWhenUpdateActivates = false,
  autoUnregisterOnError = false,
} = {}) => {
  const logger = {
    debug:
      logLevel === "debug"
        ? (...args) => console.info(...injectLogStyles(args))
        : () => {},
    info:
      logLevel === "debug" || logLevel === "info"
        ? (...args) => console.info(...injectLogStyles(args))
        : () => {},
    warn:
      logLevel === "debug" || logLevel === "info" || logLevel === "warn"
        ? (...args) => console.info(...injectLogStyles(args))
        : () => {},
    error:
      logLevel === "debug" ||
      logLevel === "info" ||
      logLevel === "warn" ||
      logLevel === "error"
        ? (...args) => console.info(...injectLogStyles(args))
        : () => {},
  }
  const injectLogStyles = (args) => {
    return [
      `%csw script`,
      `background: ${logBackgroundColor}; color: ${logColor}; padding: 1px 3px; margin: 0 1px`,
      ...args,
    ]
  }

  /*
   * The current service worker used by the browser
   * As soon as a service worker update is found (installing, waiting, activating or activated)
   * the serviceWorker object is stored into update.worker and it's possible to communicate with it.
   *
   * For the record, as soon as a new version of the service worker starts to activate
   * browser kills the old service worker
   */
  // 1. state (readyState + error + addEffect)
  const script = {
    readyState: NOTHING,
    error: null,
  }
  const callbacks = new Set()
  const triggerCallbacks = () => {
    callbacks.forEach((effect) => {
      effect(script)
    })
  }
  const mutateProps = (newProps) => {
    Object.assign(script, newProps)
    triggerCallbacks()
  }
  Object.assign(script, {
    addCallback: (callback) => {
      callbacks.add(callback)
      return () => {
        callbacks.delete(callback)
      }
    },
    addEffect: (effect) => {
      effect(script)
      return script.addCallback(effect)
    },
  })

  // 2. registration (setRegisterPromise + unregister)
  // https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration
  let registrationPromise = null
  let registration = null
  let serviceWorker = null
  let unregisterCalled = false
  const onRegistrationPromise = async () => {
    registration = await registrationPromise
    removeUpdateFoundListener = listenEvent(registration, "updatefound", () => {
      if (registration.installing === serviceWorker) {
        // browser consider first install as an update...
        return
      }
      onUpdateAvailable(registration.installing)
    })
  }
  const onServiceWorker = () => {
    removeStateChangeListener = listenEvent(
      serviceWorker,
      "statechange",
      () => {
        applyStateEffect()
      },
    )
    const applyStateEffect = () => {
      const message = {
        installing: `installing`,
        installed: `installed (waiting to activate)`,
        activating: `activating`,
        activated: `activated`,
        redundant: `redundant (unregistered by navigator)`,
      }[serviceWorker.state]
      logger.info(message)
      mutateProps({
        readyState: readyStateFromServiceWorker(serviceWorker),
      })
      if (serviceWorker.state === "redundant") {
        removeStateChangeListener()
        removeUpdateFoundListener()
        registrationPromise = null
        registration = null
        serviceWorker = null
      }
    }
    applyStateEffect()
  }
  let removeStateChangeListener = () => {}
  let removeUpdateFoundListener = () => {}
  Object.assign(script, {
    setRegisterPromise: async (promise) => {
      if (document.location.protocol !== "https:") {
        logger.warn(
          `script will be registered but navigator won't use it because protocol is not https`,
        )
      }
      registrationPromise = promise
      const controller = serviceWorkerAPI.controller
      if (controller) {
        // silently wait for registrationPromise and prevent a switch to "registering"
        // because 99.99% of the time the service worker url is the same
        // so registration is useless
        // if the script url changes it will be handled as an update
        try {
          const _registration = await registrationPromise
          const { installing, waiting, active } = _registration
          const _serviceWorker = installing || waiting || active
          if (controller === _serviceWorker) {
            // nothing to do
            return
          }
          // TODO: tester ça
          // a priori on recevra un "updatefound"
          // donc rien besoin de faire en particulier? -> a tester
          return
        } catch (e) {
          // it means script url has changed and raises an error (syntax or top level throw)
          // est ce que tout est cohérent ici (genre on devrait ptet ignorer cette erreur ou la forward a update?)
          // parce que conceptuellement c'est pas sur le script qu'il y a une erreur
          // mais sur l'update
          logger.error(`registration error`)
          mutateProps({
            error: e,
          })
        }
      }
      logger.info(`registering`)
      mutateProps({
        readyState: REGISTERING,
      })
      onRegistrationPromise()
      try {
        registration = await registrationPromise
        const { installing, waiting, active } = registration
        if (installing) {
          serviceWorker = installing
        } else if (waiting) {
          serviceWorker = waiting
        } else {
          serviceWorker = active
        }
        onServiceWorker()
        if (unregisterCalled) {
          unregisterCalled = false
          script.unregister()
          return
        }
      } catch (e) {
        logger.error(`registration error`)
        mutateProps({
          error: e,
        })
      }
    },
    unregister: async () => {
      if (script.readyState === NOTHING) {
        return
      }
      if (script.readyState === REGISTERING) {
        logger.debug("set unregisterCalled to true to unregister asap")
        unregisterCalled = true
        return
      }
      removeUpdateFoundListener()
      removeUpdateFoundListener = () => {}
      if (!registration) {
        registration = await registrationPromise
      }
      logger.info(
        "registration.unregister() (navigator will kill service worker script)",
      )
      const unregisterPromise = registration.unregister()
      await unregisterPromise
    },
  })

  Object.assign(script, {
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
  })

  if (serviceWorkerAPI.controller) {
    logger.info("found on navigator.controller")
    serviceWorker = serviceWorkerAPI.controller
    onServiceWorker()
    registrationPromise = serviceWorkerAPI.getRegistration()
    onRegistrationPromise()
  }

  let updateServiceWorker = null
  let updateRegistration = null
  const update = {
    readyState: NOTHING,
    error: null,
  }
  const updateCallbacks = new Set()
  const triggerUpdateCallbacks = () => {
    updateCallbacks.forEach((updateCallback) => {
      updateCallback(update)
    })
  }
  const mutateUpdateProps = (newProps) => {
    Object.assign(update, newProps)
    triggerUpdateCallbacks()
  }
  Object.assign(update, {
    addCallback: (updateCallback) => {
      updateCallbacks.add(updateCallback)
      return () => {
        updateCallbacks.delete(updateCallback)
      }
    },
    addEffect: (updateEffect) => {
      updateEffect(update)
      return update.addCallback(updateEffect)
    },
  })

  const onUpdateAvailable = (serviceWorkerCandidate) => {
    if (serviceWorkerCandidate === updateServiceWorker) {
      // we already know about this worker, no need to listen state changes.
      // Happens when code is notified both from
      // registration.update() and "updatefound" event
      // Which happens for manual updates (calls to registration.update())
      logger.debug("we are already aware of this service worker update")
      return
    }
    updateServiceWorker = serviceWorkerCandidate

    // https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorker/state
    const removeStateChangeListener = listenEvent(
      updateServiceWorker,
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
      }[updateServiceWorker.state]
      logger.info(message)
      if (updateServiceWorker.state === "activating") {
        serviceWorker = updateServiceWorker
      }
      if (updateServiceWorker.state === "activated") {
        removeStateChangeListener()
        updateServiceWorker = null
      }
      mutateUpdateProps({
        readyState: readyStateFromServiceWorker(updateServiceWorker),
      })
    }
    applyUpdateStateEffect()
  }
  Object.assign(update, {
    check: async () => {
      if (script.readyState === NOTHING) {
        logger.warn(`cannot check for an update, there is no script registered`)
        return false
      }
      if (!registration) {
        await registrationPromise
      }
      logger.info(
        "registration.update() (navigator will check if there is an update)",
      )
      // await for the registration promise above can take some time
      // especially when the service worker is installing for the first time
      // because it is fetching a lot of urls to put into cache.
      // In that scenario we might want to display something different ?
      // Without this, UI seems to take ages to check for an update
      try {
        mutateUpdateProps({
          readyState: REGISTERING,
        })
        updateRegistration = await registration.update()
        const { installing, waiting } = updateRegistration
        if (installing || waiting) {
          onUpdateAvailable(installing || waiting)
          return true
        }
        logger.info("no update found")
        mutateUpdateProps({
          readyState: NOTHING,
        })
        return false
      } catch (e) {
        if (autoUnregisterOnError) {
          registration.unregister()
        }
        logger.error(`error while updating script`)
        mutateUpdateProps({
          error: e,
        })

        return false
      }
    },
    activate: () => {
      if (!updateServiceWorker) {
        logger.warn(`no updated version to activate`)
        return
      }
      if (updateServiceWorker.readyState !== INSTALLED) {
        console.warn(
          `updated version is not ready to activate (readyState is "${updateServiceWorker.readyState}")`,
        )
        return
      }
      sendMessageUsingChannel(updateServiceWorker, {
        action: "skipWaiting",
      })
    },
  })

  Object.assign(update, {
    sendMessage: async (message) => {
      if (!updateServiceWorker) {
        logger.warn(`no updated version to communicate with`)
        return undefined
      }
      if (updateServiceWorker.readyState === ACTIVATING) {
        // TODO: check why we do this and what we can do to simplify
        logger.warn(
          `cannot communicate with service worker while it is activating (use script.sendMessage instead)`,
        )
        return undefined
      }
      return sendMessageUsingChannel(updateServiceWorker, message)
    },
  })

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
