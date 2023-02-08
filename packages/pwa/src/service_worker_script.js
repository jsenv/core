/*
 * Bon a priori on peut/doit faire plus simple
 * il semblerais que les appels successif a register avec une autre url sont sans effet?
 * il faut recharger la page pour pouvoir changer l'url du service worker?
 * a priori il faut unregister pour register un nouveau ça doit etre ça
 *
 */

/*
 * Donc au final:
 * - on aura pas besoin de passer l'url (seulement pendant register)
 * - il y a tout a tester
 * A la finfin:
 * - la version avancée avec clients.claim()
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

export const createServiceWorkerScript = ({
  logLevel = "info",
  logBackgroundColor = "green",
  logColor = "black",
  autoReloadWhenUpdateActivates = false,
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
      `%csw`,
      `background: ${logBackgroundColor}; color: ${logColor}; padding: 1px 3px; margin: 0 1px`,
      ...args,
    ]
  }

  /*
   * The current service worker used by the browser
   * As soon as a service worker update is found (installing, waiting, activating or activated)
   * the serviceWorker object is stored and it's possible to communicate with it.
   *
   * For the record, as soon as a new version of the service worker starts to activate
   * browser kills the old service worker (TO BE TESTED)
   */
  // 1. state
  const script = {
    state: "",
    registered: false,
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

  // 2. registration (register + unregister)
  // https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration
  let serviceWorker = null

  const setServiceWorker = (value) => {
    serviceWorker = value
    logger.debug(`service worker interface ready`)
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
        url: serviceWorker.scriptURL.slice(document.location.origin.length + 1),
        registering: false,
        registered: serviceWorker.state !== "redundant",
        state: serviceWorker.state,
      })
      if (serviceWorker.state === "redundant") {
        removeStateChangeListener()
        removeUpdateFoundListener()
        serviceWorker = null
      }
    }
    applyStateEffect()
  }
  let removeStateChangeListener = () => {}
  let removeUpdateFoundListener = () => {}
  Object.assign(script, {
    register: async (registrationPromise) => {
      if (document.location.protocol !== "https:") {
        logger.warn(
          `script will be registered but navigator won't use it because protocol is not https`,
        )
      }
      try {
        logger.info(`registering`)
        mutateProps({
          registering: true,
          error: null,
        })
        const registration = await registrationPromise
        const { installing, waiting, active } = registration
        setServiceWorker(installing || waiting || active)
        removeUpdateFoundListener = listenEvent(
          registration,
          "updatefound",
          () => {
            const { installing } = registration
            logger.debug('received "updatefound"')
            if (installing === serviceWorker) {
              // chrome consider first registration as an update...
              logger.debug(
                `"updatefound" event ignored because it's first registration`,
              )
              return
            }
            onUpdateAvailable(installing)
          },
        )
        return true
      } catch (e) {
        logger.error(`registration error`)
        mutateProps({
          registering: false,
          error: e,
        })
        return false
      }
    },
    unregister: async () => {
      if (!script.registered) {
        return false
      }
      removeUpdateFoundListener()
      removeUpdateFoundListener = () => {}
      logger.info(
        "registration.unregister() (navigator will discard service worker script)",
      )
      const registration = await serviceWorkerAPI.getRegistration()
      if (!registration) {
        return false
      }
      const unregisterResult = await registration.unregister()
      if (!unregisterResult) {
        return false
      }
      mutateProps({
        registered: false,
      })
      return true
    },
  })
  if (serviceWorkerAPI.controller) {
    logger.info("found on navigator.serviceWorker.controller")
    setServiceWorker(serviceWorkerAPI.controller)
  }

  // 3. Communication
  Object.assign(script, {
    sendMessage: async (message) => {
      if (!script.registered) {
        logger.warn(`sendMessage() ignored because script is not registered`)
        return undefined
      }
      if (script.registering) {
        await serviceWorkerAPI.ready
      }
      return sendMessageUsingChannel(serviceWorker, message)
    },
  })

  // 4. update
  let updateServiceWorker = null
  const update = {
    registering: false,
    registered: false,
    state: "",
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
      mutateUpdateProps({
        state: updateServiceWorker.state,
      })
      if (updateServiceWorker.state === "activated") {
        removeStateChangeListener()
        // updateServiceWorker = null
      }
    }
    applyUpdateStateEffect()
  }
  Object.assign(update, {
    check: async () => {
      if (!script.registered) {
        logger.warn(
          `update.check() ignored because there is no script registered`,
        )
        return false
      }
      if (script.registering) {
        logger.warn(`update.check() ignored while script is registering`)
        return false
      }
      // await for the registration promise above can take some time
      // especially when the service worker is installing for the first time
      // because it is fetching a lot of urls to put into cache.
      // In that scenario we might want to display something different ?
      // Without this, UI seems to take ages to check for an update
      const registration = await serviceWorkerAPI.getRegistration()
      if (!registration) {
        return false
      }

      try {
        mutateUpdateProps({
          registering: true,
        })
        const updateRegistration = await registration.update()
        const { installing, waiting } = updateRegistration
        if (installing || waiting) {
          onUpdateAvailable(installing || waiting)
          return true
        }
        logger.info("no update found")
        mutateUpdateProps({
          registering: false,
        })
        return false
      } catch (e) {
        logger.error(`error while registering update`)
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
      if (updateServiceWorker.state !== "installed") {
        console.warn(
          `updated version is not ready to activate (state is "${updateServiceWorker.state}")`,
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
      if (updateServiceWorker.state === "activating") {
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
