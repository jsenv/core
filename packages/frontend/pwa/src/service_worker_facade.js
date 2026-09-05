/*
 * https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration
 *
 * Two workers matter to a page: the one it runs on (registration.active, or
 * the first worker being installed) and at most one update (a worker
 * installing or waiting next to it). The update is tracked by identity: the
 * browser's "updatefound", a registration found with a pending worker and
 * checkForUpdates() finding registration.waiting can all report the same
 * worker, and it must be watched once. Everything that happens to the update
 * (state, claim, reload or hot replacement) is owned by that tracking;
 * activateUpdate() only asks the worker to skip waiting and awaits the
 * tracked outcome.
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
 *   - `activateUpdate()`: async, asks the installed update to skip waiting and
 *     resolves once it controls the page. Rejects when the update is discarded
 *     (its state becomes "redundant") or refuses skipWaiting/claim; the error
 *     is also written to `state.update.error`. The browser activates the
 *     update only once the current worker has finished its in-flight events
 *     (a fetch it is still answering, for instance): the promise can stay
 *     pending for as long as that takes, `state.update.readyState` reports
 *     where it stands ("activation_pending" while the current worker holds
 *     the switch).
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
  const stateSignal = signal({
    error: null,
    readyState: "", // registering, installing, installed, activating, activated, redundant
    meta: {},
    update: {
      error: null,
      readyState: "", // installing, installed, activation_pending, activating, activated, redundant
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

  // the worker the page runs on, and the promise of its "inspect" meta
  let currentServiceWorker = null;
  let currentInspectPromise = null;

  let updateTracked = null;
  const trackUpdate = (toServiceWorker) => {
    if (updateTracked && updateTracked.serviceWorker === toServiceWorker) {
      return updateTracked;
    }

    let controllingPromise = null;
    const ensureControlling = () => {
      if (!controllingPromise) {
        controllingPromise = ensureIsControllingNavigator(toServiceWorker);
      }
      return controllingPromise;
    };

    const trackingPromise = (async () => {
      const [fromScriptMeta, toScriptMeta] = await Promise.all([
        currentInspectPromise || {},
        inspectServiceWorker(toServiceWorker),
      ]);
      pwaLogger.info(`update from`, fromScriptMeta, `to`, toScriptMeta);

      const serviceWorkerHotReplacer = createServiceWorkerHotReplacer({
        resourceUpdateHandlers,
        fromScriptMeta,
        toScriptMeta,
      });
      // readyState is written with the meta: what is left in the state from a
      // previous update must not be read next to this one's meta
      mutate({
        meta: fromScriptMeta,
        update: {
          error: null,
          readyState: toServiceWorker.state,
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
            try {
              await ensureControlling();
            } catch (e) {
              mutate({ update: { error: e } });
              return;
            }
            pwaLogger.info("update is controlling navigator");
            // the page runs on the update from here: a next update is diffed
            // against it
            currentServiceWorker = toServiceWorker;
            currentInspectPromise = Promise.resolve(toScriptMeta);
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
    })();

    const activate = async () => {
      try {
        await trackingPromise;
        await whenServiceWorkerReaches(toServiceWorker, "installed");
        if (toServiceWorker.state === "installed") {
          mutate({
            update: { error: null, readyState: "activation_pending" },
          });
        }
        pwaLogger.info("request skipWaiting");
        await requestSkipWaitingOnServiceWorker(toServiceWorker);
        pwaLogger.info("skipWaiting done, wait for update to be activated");
        await whenServiceWorkerReaches(toServiceWorker, "activated");
        pwaLogger.info("update is activated");
        await ensureControlling();
      } catch (e) {
        mutate({ update: { error: e } });
        throw e;
      }
    };

    updateTracked = {
      serviceWorker: toServiceWorker,
      activate,
    };
    return updateTracked;
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
    const { installing, waiting, active } = registration;
    // The page runs on the active worker; without one, the registration is
    // installing its first worker. A worker installing or waiting next to the
    // active one is an update the browser found before the facade looked
    // (typically during page load): its "updatefound" is gone.
    currentServiceWorker = active || waiting || installing;
    watchedRegistration = registration;
    registration.addEventListener("updatefound", () => {
      // https://github.com/w3c/ServiceWorker/issues/515
      // and listening onupdatefound after a setTimeout is not enough
      // as firefox will trigger "updatefound" when the worker is activating as well
      const { installing } = registration;
      if (!installing || installing === currentServiceWorker) {
        return;
      }
      trackUpdate(installing);
    });
    serviceWorkerAPI.startMessages(); // is it useful?
    currentInspectPromise = inspectServiceWorker(currentServiceWorker);
    if (active && (installing || waiting)) {
      trackUpdate(installing || waiting);
    }
    const fromServiceWorker = currentServiceWorker;
    const fromScriptMeta = await currentInspectPromise;

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
      // update.readyState belongs to the tracked update worker and survives a
      // check; only the error of a previous check is cleared here
      mutate({
        update: {
          error: null,
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
        trackUpdate(updateRegistration.waiting);
        return true;
      }
      // when installing, no need to call trackUpdate, browser fires "updatefound"
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
      if (!serviceWorker || serviceWorker === currentServiceWorker) {
        pwaLogger.warn("no update to activate");
        return;
      }
      const update = trackUpdate(serviceWorker);
      await update.activate();
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

// in the order a worker goes through them; "redundant" is the end of any of them
const SERVICE_WORKER_STATES = [
  "parsed",
  "installing",
  "installed",
  "activating",
  "activated",
];
const whenServiceWorkerReaches = (serviceWorker, targetState) => {
  return new Promise((resolve, reject) => {
    const check = () => {
      const { state } = serviceWorker;
      if (state === "redundant") {
        serviceWorker.removeEventListener("statechange", check);
        reject(
          new Error(
            `service worker is redundant, it will never be "${targetState}"`,
          ),
        );
        return;
      }
      if (
        SERVICE_WORKER_STATES.indexOf(state) >=
        SERVICE_WORKER_STATES.indexOf(targetState)
      ) {
        serviceWorker.removeEventListener("statechange", check);
        resolve();
      }
    };
    serviceWorker.addEventListener("statechange", check);
    check();
  });
};

const ensureIsControllingNavigator = (serviceWorker) => {
  if (serviceWorkerAPI.controller === serviceWorker) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      serviceWorkerAPI.removeEventListener(
        "controllerchange",
        oncontrollerchange,
      );
      serviceWorker.removeEventListener("statechange", onstatechange);
    };
    const oncontrollerchange = () => {
      if (serviceWorkerAPI.controller === serviceWorker) {
        cleanup();
        resolve();
      }
    };
    const onstatechange = () => {
      if (serviceWorker.state === "redundant") {
        cleanup();
        reject(
          new Error(
            `service worker is redundant, it will never control the navigator`,
          ),
        );
      }
    };
    serviceWorkerAPI.addEventListener("controllerchange", oncontrollerchange);
    serviceWorker.addEventListener("statechange", onstatechange);
    pwaLogger.info("request claim");
    requestClaimOnServiceWorker(serviceWorker).catch((e) => {
      cleanup();
      reject(e);
    });
  });
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
