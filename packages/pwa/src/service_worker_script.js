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

import { sigi } from "@jsenv/sigi"

import { pwaLogger } from "./pwa_logger.js"
import { serviceWorkerAPI } from "./internal/service_worker_api.js"
import {
  inspectServiceWorker,
  requestSkipWaitingOnServiceWorker,
  requestClaimOnServiceWorker,
  postMessageToServiceWorker,
} from "./internal/service_worker_communication.js"
import { createUpdateHotHandler } from "./internal/service_worker_hot_update.js"

export const createServiceWorkerScript = ({
  hotUpdateHandlers = {},
  scope = "/",
} = {}) => {
  let fromInspectPromise = null

  const { state, subscribe, mutate } = sigi({
    error: null,
    readyState: "", // registering, installing, installed, activating, activated
    meta: {},
    update: {
      error: null,
      readyState: "", // installing, installed, activating, activated
      meta: {},
      reloadRequired: true,
    },
  })

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
    mutate({
      meta: fromScriptMeta,
      update: {
        meta: toScriptMeta,
        reloadRequired: !updateHotHandler,
      },
    })

    const applyUpdateStateEffects = async () => {
      const effects = {
        installing: () => {
          mutate({
            update: { readyState: "installing" },
          })
        },
        installed: () => {
          mutate({
            update: { readyState: "installed" },
          })
        },
        activating: () => {
          mutate({
            update: { readyState: "activating" },
          })
        },
        activated: async () => {
          mutate({
            update: { readyState: "activated" },
          })
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
        },
        redundant: () => {
          toServiceWorker.removeEventListener(
            "statechange",
            applyUpdateStateEffects,
          )
          mutate({
            update: { readyState: "redundant" },
          })
        },
      }
      await effects[toServiceWorker.state]()
    }
    applyUpdateStateEffects()
    toServiceWorker.addEventListener("statechange", applyUpdateStateEffects)
  }

  const watchRegistration = async (registration) => {
    // setTimeout because of https://github.com/w3c/ServiceWorker/issues/515
    setTimeout(() => {
      registration.onupdatefound = () => {
        onUpdateFound(registration.installing)
      }
    })
    const { installing, waiting, active } = registration
    const fromServiceWorker = installing || waiting || active
    serviceWorkerAPI.startMessages()

    fromInspectPromise = inspectServiceWorker(fromServiceWorker)
    const fromScriptMeta = await fromInspectPromise

    const applyStateChangeEffect = () => {
      console.log("got state", fromServiceWorker.state, fromScriptMeta)
      const effects = {
        installing: () => {
          mutate({ readyState: "installing", meta: fromScriptMeta })
        },
        installed: () => {
          mutate({ readyState: "installed", meta: fromScriptMeta })
        },
        activating: () => {
          mutate({ readyState: "activating", meta: fromScriptMeta })
        },
        activated: () => {
          mutate({ readyState: "activated", meta: fromScriptMeta })
        },
        redundant: () => {
          fromServiceWorker.removeEventListener(
            "statechange",
            applyStateChangeEffect,
          )
          fromServiceWorker.removeEventListener("error", onError)
          mutate({ readyState: "redundant", meta: fromScriptMeta })
        },
      }
      effects[fromServiceWorker.state]()
    }
    const onError = (errorEvent) => {
      debugger
      mutate({ error: errorEvent })
    }
    applyStateChangeEffect()
    fromServiceWorker.addEventListener("error", onError)
    fromServiceWorker.addEventListener("statechange", applyStateChangeEffect)
  }

  const init = async () => {
    const registration = await serviceWorkerAPI.getRegistration(scope)
    if (registration) {
      watchRegistration(registration)
    }
  }
  init()

  return {
    state,
    subscribe,
    setRegistationPromise: async (registrationPromise) => {
      try {
        mutate({ error: null, readyState: "registering" })
        const registration = await registrationPromise
        watchRegistration(registration)
      } catch (e) {
        mutate({ error: e })
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
    activateUpdate: async () => {
      pwaLogger.infoGroupCollapsed("activateUpdate()")
      const registration = await serviceWorkerAPI.getRegistration(scope)
      if (!registration) {
        pwaLogger.warn("no registration found")
        pwaLogger.groupEnd()
        return
      }
      const { installing } = registration
      if (!installing) {
        pwaLogger.warn("no update found on registration.installing")
        pwaLogger.groupEnd()
        return
      }

      const activatedPromise = new Promise((resolve) => {
        installing.onstatechange = () => {
          if (installing.state === "activated") {
            installing.onstatechange = null
            resolve()
          }
        }
      })
      pwaLogger.info("update is installed, send skipWaiting")
      await requestSkipWaitingOnServiceWorker(installing)
      pwaLogger.info("skipWaiting done, wait for worker to be activated")
      await activatedPromise
      await ensureIsControllingNavigator(installing)
    },
    unregister: async () => {
      const registration = await serviceWorkerAPI.getRegistration(scope)
      if (!registration) {
        pwaLogger.debug("nothing to unregister")
        return false
      }
      pwaLogger.infoGroupCollapsed("registration.unregister()")
      const unregistered = await registration.unregister()
      if (unregistered) {
        pwaLogger.info("unregister done")
        pwaLogger.groupEnd()
        return true
      }
      pwaLogger.warn("unregister failed")
      pwaLogger.groupEnd()
      return false
    },
    postMessage: async (message) => {
      const registration = await serviceWorkerAPI.getRegistration(scope)
      if (!registration) {
        pwaLogger.warn(`no service worker script to communicate with`)
        return undefined
      }
      const serviceWorker =
        registration.active || registration.waiting || registration.installing
      pwaLogger.info(
        `postMessage(${JSON.stringify(message)}) on ${serviceWorker.scriptURL}`,
      )
      return postMessageToServiceWorker(serviceWorker, message)
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
