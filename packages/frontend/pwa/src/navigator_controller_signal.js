import { signal } from "@preact/signals";
import {
  canUseServiceWorkers,
  serviceWorkerAPI,
} from "./internal/service_worker_api.js";
import { inspectServiceWorker } from "./internal/service_worker_communication.js";

/**
 * Reactive signal exposing the service worker currently controlling the page.
 * `navigatorControllerSignal.value` is null when the page is not controlled,
 * otherwise `{ meta }` where meta is the object returned by the service worker
 * script in response to the "inspect" action (empty when the script does not
 * implement it). `navigatorControllerSignal.subscribe(callback)` calls back
 * immediately and on every controller change.
 */
export const navigatorControllerSignal = signal(null);

const applyControllerEffect = async () => {
  if (!canUseServiceWorkers) {
    navigatorControllerSignal.value = null;
    return;
  }
  const { controller } = serviceWorkerAPI;
  if (!controller) {
    navigatorControllerSignal.value = null;
    return;
  }
  const meta = await inspectServiceWorker(serviceWorkerAPI.controller);
  navigatorControllerSignal.value = { meta };
};
applyControllerEffect();
if (canUseServiceWorkers) {
  serviceWorkerAPI.addEventListener("controllerchange", applyControllerEffect);
}
