/*
 * https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration
 */

import { serviceWorkerAPI } from "./internal/service_worker_api.js"
import {
  inspectServiceWorker,
  requestSkipWaitingOnServiceWorker,
  requestClaimOnServiceWorker,
} from "./internal/service_worker_communication.js"
import { createUpdateHotHandler } from "./internal/service_worker_hot_update.js"

export const createServiceWorkerScript = ({
  logLevel = "info",
  logBackgroundColor = "green",
  logColor = "black",
  onError = () => {},
  onInstalling = () => {},
  onInstalled = () => {},
  onActivating = () => {},
  onActivated = () => {},
  onRedundant = () => {},
  onUpdateInstalling = () => {},
  onUpdateAvailable = () => {},
  hotUpdateHandlers = {},
  scope = "/",
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
    debugGroupCollapsed:
      logLevel === "debug"
        ? (...args) => console.group(...injectLogStyles(args))
        : () => {},
    debugGroupEnd:
      logLevel === "debug"
        ? (...args) => console.groupEnd(...injectLogStyles(args))
        : () => {},
  }
  const injectLogStyles = (args) => {
    return [
      `%csw`,
      `background: ${logBackgroundColor}; color: ${logColor}; padding: 1px 3px; margin: 0 1px`,
      ...args,
    ]
  }

  let fromInspectPromise = null

  const onUpdateFound = async (toServiceWorker) => {
    const fromScriptMeta = await fromInspectPromise
    const toScriptMeta = await inspectServiceWorker(toServiceWorker)

    const updateHotHandler = createUpdateHotHandler({
      hotUpdateHandlers,
      fromScriptMeta,
      toScriptMeta,
    })
    const reloadRequired = !updateHotHandler

    const applyUpdateStateEffects = async () => {
      if (toServiceWorker.state === "installing") {
        onUpdateInstalling({
          fromScriptMeta,
          toScriptMeta,
          reloadRequired,
        })
        return
      }
      if (toServiceWorker.state === "installed") {
        onUpdateAvailable({
          fromScriptMeta,
          toScriptMeta,
          reloadRequired,
          activate: async () => {
            if (toServiceWorker.state === "installed") {
              const activatedPromise = new Promise((resolve) => {
                toServiceWorker.onstatechange = () => {
                  if (toServiceWorker.state === "activated") {
                    toServiceWorker.onstatechange = null
                    resolve()
                  }
                }
              })
              logger.info("update is installed, send skipWaiting")
              await requestSkipWaitingOnServiceWorker(toServiceWorker)
              logger.info("skipWaiting done, wait for worker to be activated")
              await activatedPromise
            }
            if (toServiceWorker.state === "activated") {
              await ensureIsControllingNavigator(toServiceWorker)
              return
            }
            throw new Error(
              `unexpected state on service worker update: "${toServiceWorker.state}"`,
            )
          },
        })
        return
      }
      if (toServiceWorker.state === "activated") {
        toServiceWorker.removeEventListener(
          "statechange",
          applyUpdateStateEffects,
        )
        await ensureIsControllingNavigator()
        if (updateHotHandler) {
          logger.info("apply update without reloading")
          await updateHotHandler()
        } else {
          logger.info("reloading browser")
          // the other tabs should reload
          // how can we achieve this???
          reloadPage()
        }
      }
    }
    applyUpdateStateEffects()
    toServiceWorker.addEventListener("statechange", applyUpdateStateEffects)
  }

  const watchRegistration = async (registration) => {
    // setTimeout because of https://github.com/w3c/ServiceWorker/issues/515
    setTimeout(() => {
      registration.onupdatefound = async () => {
        onUpdateFound(registration.installing)
      }
    })
    const { installing, waiting, active } = registration
    const fromServiceWorker = installing || waiting || active
    serviceWorkerAPI.startMessages()

    fromInspectPromise = inspectServiceWorker(fromServiceWorker)
    const fromScriptMeta = await fromInspectPromise

    const applyStateEffect = () => {
      if (fromServiceWorker.state === "installing") {
        onInstalling(fromScriptMeta)
        return
      }
      if (fromServiceWorker.state === "installed") {
        onInstalled(fromScriptMeta)
        return
      }
      if (fromServiceWorker.state === "activating") {
        onActivating(fromScriptMeta)
        return
      }
      if (fromServiceWorker.state === "activated") {
        onActivated(fromScriptMeta)
        return
      }
      if (fromServiceWorker.state === "redundant") {
        fromServiceWorker.removeEventListener("statechange", applyStateEffect)
        onRedundant(fromScriptMeta)
      }
    }
    applyStateEffect()
    fromServiceWorker.addEventListener("statechange", applyStateEffect)
  }

  const init = async () => {
    const registration = await serviceWorkerAPI.getRegistration(scope)
    if (registration) {
      watchRegistration(registration)
    }
  }
  init()

  const [controllerSignal] = createSignalController(null)
  const applyControllerEffect = async () => {
    const { controller } = serviceWorkerAPI.controller
    if (controller) {
      const controllerScriptMeta = await inspectServiceWorker(
        serviceWorkerAPI.controller,
      )
      controllerSignal.value = {
        scriptMeta: controllerScriptMeta,
      }
    } else {
      controllerSignal.value = null
    }
  }
  applyControllerEffect()
  serviceWorkerAPI.addEventListener("controllerchange", applyControllerEffect)

  return {
    controllerSignal,
    setRegistationPromise: async (registrationPromise) => {
      try {
        const registration = await registrationPromise
        watchRegistration(registration)
      } catch (e) {
        onError(e)
      }
    },
    checkForUpdates: async () => {
      logger.debugGroupCollapsed("checkForUpdates()")
      const registration = await serviceWorkerAPI.getRegistration(scope)
      if (!registration) {
        logger.debugGroupEnd("no registration found")
        return false
      }
      logger.debugGroup("call registration.update()")
      const updateRegistration = await registration.update()
      if (!updateRegistration.installing && !updateRegistration.waiting) {
        logger.debugGroupEnd(
          "no update found on registration.installing and registration.waiting",
        )
        return false
      }
      logger.debugGroupEnd("service worker found on registration")
      return true
    },
    unregister: async () => {
      const registration = await serviceWorkerAPI.getRegistration(scope)
      if (!registration) {
        return false
      }
      const unregistered = await registration.unregister()
      if (unregistered) {
        logger.info("unregister done")
        return true
      }
      logger.warn("unregister failed")
      return false
    },
  }
}

const createSignalController = (initialValue) => {
  const channel = createChannel()
  const signal = createSignal(initialValue, channel)
  return [signal, channel]
}

const createSignal = (initialValue, channel) => {
  let value = initialValue

  return {
    get value() {
      return value
    },
    set value(newValue) {
      if (value !== newValue) {
        value = newValue
        channel.post(newValue)
      }
    },
    effect: (callback) => {
      callback(value)
      return channel.listen()
    },
  }
}

const createChannel = () => {
  const callbackSet = new Set()
  return {
    listen: (callback) => {
      callbackSet.add(callback)
      return () => {
        callbackSet.delete(callback)
      }
    },
    post: (value) => {
      callbackSet.forEach((callback) => {
        callback(value)
      })
    },
  }
}

const ensureIsControllingNavigator = (serviceWorker) => {
  if (serviceWorkerAPI.controller === serviceWorker) {
    return null
  }
  const becomesControllerPromise = new Promise((resolve) => {
    const oncontrollerchange = () => {
      if (serviceWorkerAPI.controller === serviceWorker) {
        serviceWorkerAPI.removeEventListener(
          "controllerchange",
          oncontrollerchange,
        )
        resolve()
      }
    }
    serviceWorkerAPI.addEventListener("controllerchange", oncontrollerchange)
  })
  requestClaimOnServiceWorker(serviceWorker)
  return becomesControllerPromise
}

let reloading = false
const reloadPage = () => {
  if (reloading) {
    return
  }
  reloading = true
  window.location.reload()
}
