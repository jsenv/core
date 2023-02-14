/*
 * https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration
 *
 *
 * TODO:
 * - en priorité: avoir des erreurs dans tous les cas un par un
 * pour voir ce qu'on voudrait dans l'api
 *   - top level error first register
 *   - error during install event
 *   - error during activate event
 *   - top level error after update
 *   - etc...
 */

import { pwaLogger } from "./pwa_logger.js"
import { serviceWorkerAPI } from "./internal/service_worker_api.js"
import {
  inspectServiceWorker,
  requestSkipWaitingOnServiceWorker,
  requestClaimOnServiceWorker,
} from "./internal/service_worker_communication.js"
import { createUpdateHotHandler } from "./internal/service_worker_hot_update.js"

export const createServiceWorkerScript = ({
  // TODO: replace with something like .effect()
  // sachant que hormis onError, les autres sont pas vraiment important
  onError = () => {},
  onInstalling = () => {},
  onInstalled = () => {},
  onActivating = () => {},
  onActivated = () => {},
  onRedundant = () => {},
  // TODO: replace with something like update.effect()
  onUpdateInstalling = () => {},
  onUpdateWaiting = () => {},
  hotUpdateHandlers = {},
  scope = "/",
} = {}) => {
  let fromInspectPromise = null

  const hotUpdatesHandlersResolved = {}
  Object.keys(hotUpdateHandlers).forEach((url) => {
    const urlResolved = new URL(url, document.location).href
    hotUpdatesHandlersResolved[urlResolved] = hotUpdateHandlers[url]
  })
  hotUpdateHandlers = hotUpdatesHandlersResolved

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
        onUpdateWaiting({
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
              pwaLogger.info("update is installed, send skipWaiting")
              await requestSkipWaitingOnServiceWorker(toServiceWorker)
              pwaLogger.info(
                "skipWaiting done, wait for worker to be activated",
              )
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
        await ensureIsControllingNavigator(toServiceWorker)
        if (updateHotHandler) {
          pwaLogger.info("apply update without reloading")
          await updateHotHandler()
        } else {
          pwaLogger.info("reloading browser")
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

  return {
    setRegistationPromise: async (registrationPromise) => {
      try {
        const registration = await registrationPromise
        watchRegistration(registration)
      } catch (e) {
        onError(e)
      }
    },
    checkForUpdates: async () => {
      pwaLogger.debugGroupCollapsed("checkForUpdates()")
      const registration = await serviceWorkerAPI.getRegistration(scope)
      if (!registration) {
        pwaLogger.debug("no registration found")
        pwaLogger.groupEnd()
        return false
      }
      pwaLogger.debug("call registration.update()")
      const updateRegistration = await registration.update()
      if (!updateRegistration.installing && !updateRegistration.waiting) {
        pwaLogger.debug(
          "no update found on registration.installing and registration.waiting",
        )
        pwaLogger.groupEnd()

        return false
      }
      pwaLogger.debug("service worker found on registration")
      pwaLogger.groupEnd()
      return true
    },
    unregister: async () => {
      const registration = await serviceWorkerAPI.getRegistration(scope)
      if (!registration) {
        return false
      }
      const unregistered = await registration.unregister()
      if (unregistered) {
        pwaLogger.info("unregister done")
        return true
      }
      pwaLogger.warn("unregister failed")
      return false
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
