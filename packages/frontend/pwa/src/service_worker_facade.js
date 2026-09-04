/*
 * https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration
 */

import { signal } from "@preact/signals";

import {
  canUseServiceWorkers,
  serviceWorkerAPI,
} from "./internal/service_worker_api.js";
import {
  inspectServiceWorker,
  postMessageToServiceWorker,
  requestClaimOnServiceWorker,
  requestSkipWaitingOnServiceWorker,
} from "./internal/service_worker_communication.js";
import { createServiceWorkerHotReplacer } from "./internal/service_worker_hot_replacement.js";
import { pwaLogger } from "./pwa_logger.js";

/**
 * Creates an object simplifying service worker registration, update detection,
 * update activation and communication with the service worker script.
 *
 * The service worker script is expected to answer `{ action }` messages sent
 * with a MessageChannel port ("inspect", "skipWaiting", "claim",
 * "postReloadAfterUpdateToClients") — `@jsenv/service-worker` implements this
 * protocol. With a plain service worker script everything still works but
 * degrades: "inspect" times out after 1s so `state.meta` stays empty and every
 * update requires a page reload.
 *
 * @param {Object} [options]
 * @param {string} [options.scope] Registration scope used to find the service
 *   worker registration; defaults to the whole origin.
 * @param {boolean} [options.autoclaimOnFirstActivation=false] When the very
 *   first service worker activates, ask it to claim the page immediately
 *   instead of waiting for the next navigation.
 * @returns {Object} facade with:
 *   - `stateSignal`: signal holding the state object, see its shape below
 *   - `state`: the state object itself (`stateSignal.value`)
 *   - `subscribe(callback)`: called immediately then on every state change;
 *     returns an unsubscribe function
 *   - `setRegistrationPromise(promise)`: give it the return value of
 *     `navigator.serviceWorker.register(url)`
 *   - `checkForUpdates()`: async, resolves to true if an update was found
 *   - `activateUpdate()`: async, activates the installed update (skipWaiting +
 *     claim) and resolves once it controls the page
 *   - `unregister()`: async, unregisters the service worker
 *   - `sendMessage(message)`: async, posts a message to the service worker and
 *     resolves with its response
 *   - `defineResourceUpdateHandler(url, handler)`: register how to hot-replace
 *     a resource during an update instead of reloading the page
 */
export const createServiceWorkerFacade = ({
  scope,
  autoclaimOnFirstActivation = false,
} = {}) => {
  let fromInspectPromise = null;

  const stateSignal = signal({
    error: null,
    readyState: "", // registering, installing, installed, activating, activated
    meta: {},
    update: {
      error: null,
      readyState: "", // installing, installed, activating, activated
      meta: {},
      reloadRequired: true,
    },
  });
  // The state object is replaced, never mutated: subscribers are notified by
  // the signal write. "update" is the one branch merged rather than replaced,
  // so a caller can touch one of its properties in a single write.
  const mutate = (partial) => {
    const state = stateSignal.peek();
    const stateWithPartial = { ...state, ...partial };
    if (partial.update) {
      stateWithPartial.update = { ...state.update, ...partial.update };
    }
    stateSignal.value = stateWithPartial;
  };

  const resourceUpdateHandlers = {};

  const getCurrentServiceWorker = async () => {
    const { controller } = serviceWorkerAPI;
    if (controller) {
      return controller;
    }
    const reg = await serviceWorkerAPI.getRegistration();
    return reg.waiting || reg.installing;
  };

  const onUpdateFound = async (toServiceWorker) => {
    const fromServiceWorker = await getCurrentServiceWorker();
    const [fromScriptMeta, toScriptMeta] = await Promise.all([
      inspectServiceWorker(fromServiceWorker),
      inspectServiceWorker(toServiceWorker),
    ]);

    pwaLogger.info(`update from`, fromScriptMeta, `to`, toScriptMeta);

    const serviceWorkerHotReplacer = createServiceWorkerHotReplacer({
      resourceUpdateHandlers,
      fromScriptMeta,
      toScriptMeta,
    });
    mutate({
      meta: fromScriptMeta,
      update: {
        meta: toScriptMeta,
        reloadRequired: !serviceWorkerHotReplacer,
      },
    });

    const onUpdateError = (errorEvent) => {
      mutate({ error: errorEvent });
    };
    toServiceWorker.addEventListener("error", onUpdateError);
    const applyUpdateStateEffects = async () => {
      const effects = {
        installing: () => {
          mutate({
            update: { readyState: "installing" },
          });
        },
        installed: () => {
          mutate({
            update: { readyState: "installed" },
          });
        },
        activating: () => {
          mutate({
            update: { readyState: "activating" },
          });
        },
        activated: async () => {
          mutate({
            update: { readyState: "activated" },
          });
          await ensureIsControllingNavigator(toServiceWorker);
          pwaLogger.info("update is controlling navigator");
          if (serviceWorkerHotReplacer) {
            pwaLogger.info("hot replace service worker");
            serviceWorkerHotReplacer();
          } else {
            pwaLogger.info("post reload after update to clients");
            postMessageToServiceWorker(toServiceWorker, {
              action: "postReloadAfterUpdateToClients",
            });
          }
        },
        redundant: () => {
          toServiceWorker.removeEventListener("error", onUpdateError);
          toServiceWorker.removeEventListener(
            "statechange",
            applyUpdateStateEffects,
          );
          mutate({
            update: { readyState: "redundant" },
          });
        },
      };
      await effects[toServiceWorker.state]();
    };
    applyUpdateStateEffects();
    toServiceWorker.addEventListener("statechange", applyUpdateStateEffects);
  };

  // Two callers can legitimately reach the same registration: init() finds it
  // via getRegistration() while setRegistrationPromise() receives it from
  // navigator.serviceWorker.register(). Watching twice would duplicate every
  // listener and state mutation, so the registration is watched only once.
  let watchedRegistration = null;
  const watchRegistration = async (registration) => {
    if (watchedRegistration === registration) {
      return;
    }
    watchedRegistration = registration;
    const { installing, waiting, active } = registration;
    const fromServiceWorker = installing || waiting || active;
    registration.onupdatefound = () => {
      // https://github.com/w3c/ServiceWorker/issues/515
      // and listening onupdatefound after a setTimeout is not enough
      // as firefox will trigger "updatefound" when the worker is activating as well
      if (registration.installing === fromServiceWorker) {
        return;
      }
      onUpdateFound(registration.installing);
    };
    serviceWorkerAPI.startMessages(); // is it useful?
    fromInspectPromise = inspectServiceWorker(fromServiceWorker);
    const fromScriptMeta = await fromInspectPromise;

    const onError = (errorEvent) => {
      mutate({ error: errorEvent });
    };
    fromServiceWorker.addEventListener("error", onError);
    const applyStateChangeEffect = () => {
      const effects = {
        installing: () => {
          mutate({ readyState: "installing", meta: fromScriptMeta });
        },
        installed: () => {
          mutate({ readyState: "installed", meta: fromScriptMeta });
        },
        activating: () => {
          mutate({ readyState: "activating", meta: fromScriptMeta });
        },
        activated: () => {
          mutate({ readyState: "activated", meta: fromScriptMeta });
          if (autoclaimOnFirstActivation && !serviceWorkerAPI.controller) {
            requestClaimOnServiceWorker(fromServiceWorker);
          }
        },
        redundant: () => {
          fromServiceWorker.removeEventListener(
            "statechange",
            applyStateChangeEffect,
          );
          fromServiceWorker.removeEventListener("error", onError);
          mutate({ readyState: "redundant", meta: fromScriptMeta });
        },
      };
      effects[fromServiceWorker.state]();
    };
    applyStateChangeEffect();
    fromServiceWorker.addEventListener("statechange", applyStateChangeEffect);
  };

  const init = async () => {
    serviceWorkerAPI.addEventListener("controllerchange", async () => {
      const controller = serviceWorkerAPI.controller;
      // happens when an other tab register the service worker and
      // make it control the navigator (when autoclaimOnFirstActivation is true)
      if (controller && stateSignal.peek().readyState === "") {
        const registration = await serviceWorkerAPI.getRegistration();
        watchRegistration(registration);
      }
    });

    const registration = await serviceWorkerAPI.getRegistration(scope);
    if (registration) {
      watchRegistration(registration);
    }
  };
  if (canUseServiceWorkers) {
    init();
  }

  return {
    stateSignal,
    get state() {
      return stateSignal.value;
    },
    subscribe: (callback) => stateSignal.subscribe(callback),
    setRegistrationPromise: async (registrationPromise) => {
      try {
        mutate({ error: null, readyState: "registering" });
        const registration = await registrationPromise;
        watchRegistration(registration);
      } catch (e) {
        mutate({ error: e });
      }
    },
    unregister: async () => {
      if (!canUseServiceWorkers) {
        pwaLogger.debug("service worker API not available");
        return false;
      }
      const registration = await serviceWorkerAPI.getRegistration(scope);
      if (!registration) {
        pwaLogger.debug("nothing to unregister");
        return false;
      }
      const unregistered = await registration.unregister();
      if (unregistered) {
        pwaLogger.info("registration.unregister() done");
        return true;
      }
      pwaLogger.info("registration.unregister() failed");
      return false;
    },
    checkForUpdates: async () => {
      if (!canUseServiceWorkers) {
        pwaLogger.debug("service worker API not available");
        return false;
      }
      const registration = await serviceWorkerAPI.getRegistration(scope);
      if (!registration) {
        pwaLogger.info("nothing to update");
        return false;
      }
      mutate({
        update: {
          error: null,
          readyState: "",
        },
      });
      let updateRegistration;
      try {
        updateRegistration = await registration.update();
      } catch (e) {
        mutate({
          update: {
            error: e,
          },
        });
        return false;
      }
      if (updateRegistration.waiting) {
        pwaLogger.info(
          "registration.update() -> found on registration.waiting",
        );
        onUpdateFound(updateRegistration.waiting);
        return true;
      }
      // when installing, no need to call onUpdateFound, browser does it for us
      if (updateRegistration.installing) {
        pwaLogger.info(
          "registration.update() -> found on registration.installing",
        );
        return true;
      }
      pwaLogger.info("registration.update() -> no update found");
      return false;
    },
    activateUpdate: async () => {
      if (!canUseServiceWorkers) {
        pwaLogger.debug("service worker API not available");
        return;
      }
      const registration = await serviceWorkerAPI.getRegistration(scope);
      if (!registration) {
        pwaLogger.warn("nothing to activate");
        return;
      }
      const serviceWorker = registration.installing || registration.waiting;
      if (!serviceWorker) {
        pwaLogger.warn("no update to activate");
        return;
      }
      if (serviceWorker.state === "installing") {
        pwaLogger.info("an update is installing, wait for it to be installed");
        await new Promise((resolve) => {
          serviceWorker.onstatechange = () => {
            if (serviceWorker.state === "installed") {
              serviceWorker.onstatechange = null;
              resolve();
            }
          };
        });
      } else {
        pwaLogger.info("an update is waiting to activate");
      }
      const activatedPromise = new Promise((resolve) => {
        serviceWorker.onstatechange = () => {
          if (serviceWorker.state === "activated") {
            serviceWorker.onstatechange = null;
            resolve();
          }
        };
      });
      pwaLogger.info("send skipWaiting");
      await requestSkipWaitingOnServiceWorker(serviceWorker);
      pwaLogger.info(
        `skipWaiting done, wait for update to switch to activated`,
      );
      await activatedPromise;
      pwaLogger.info("update is activated");
      await ensureIsControllingNavigator(serviceWorker);
      pwaLogger.info("update is controlling navigator");
    },
    sendMessage: async (message) => {
      if (!canUseServiceWorkers) {
        pwaLogger.debug("service worker API not available");
        return undefined;
      }
      const registration = await serviceWorkerAPI.getRegistration(scope);
      if (!registration) {
        pwaLogger.warn(`no service worker script to communicate with`);
        return undefined;
      }
      const serviceWorker =
        registration.installing || registration.waiting || registration.active;
      // registration.active || registration.waiting || registration.installing
      pwaLogger.info(
        `postMessage(${JSON.stringify(message)}) on ${serviceWorker.scriptURL}`,
      );
      return postMessageToServiceWorker(serviceWorker, message);
    },
    defineResourceUpdateHandler: (url, handler) => {
      if (typeof handler !== "function" && typeof handler !== "object") {
        throw new TypeError(
          `handler must be a function or an object, got ${handler}`,
        );
      }
      const urlResolved = new URL(url, document.location).href;
      resourceUpdateHandlers[urlResolved] = handler;
    },
  };
};

const ensureIsControllingNavigator = (serviceWorker) => {
  if (serviceWorkerAPI.controller === serviceWorker) {
    return null;
  }
  const becomesControllerPromise = new Promise((resolve) => {
    const oncontrollerchange = () => {
      if (serviceWorkerAPI.controller === serviceWorker) {
        serviceWorkerAPI.removeEventListener(
          "controllerchange",
          oncontrollerchange,
        );
        resolve();
      }
    };
    serviceWorkerAPI.addEventListener("controllerchange", oncontrollerchange);
  });
  pwaLogger.info("request claim");
  requestClaimOnServiceWorker(serviceWorker);
  return becomesControllerPromise;
};

if (canUseServiceWorkers) {
  // https://github.com/GoogleChrome/workbox/issues/1120
  let reloading = false;
  const reloadPage = () => {
    if (reloading) {
      return;
    }
    reloading = true;
    window.location.reload();
  };
  serviceWorkerAPI.addEventListener("message", (event) => {
    if (event.data === "reload_after_update") {
      pwaLogger.info(
        '"reload_after_update" received from service worker -> reload page',
      );
      reloadPage();
    }
  });
}
