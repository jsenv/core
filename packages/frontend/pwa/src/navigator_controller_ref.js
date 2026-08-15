import { sigref } from "@jsenv/sigi";
import {
  canUseServiceWorkers,
  serviceWorkerAPI,
} from "./internal/service_worker_api.js";
import { inspectServiceWorker } from "./internal/service_worker_communication.js";

/**
 * Reactive ref exposing the service worker currently controlling the page.
 * `navigatorControllerRef.value` is null when the page is not controlled,
 * otherwise `{ meta }` where meta is the object returned by the service worker
 * script in response to the "inspect" action (empty when the script does not
 * implement it). `navigatorControllerRef.subscribe(callback)` calls back
 * immediately and on every controller change.
 */
const [navigatorControllerRef, navigatorControllerSetter] = sigref(null);

const applyControllerEffect = async () => {
  if (!canUseServiceWorkers) {
    navigatorControllerSetter(null);
    return;
  }
  const { controller } = serviceWorkerAPI;
  if (!controller) {
    navigatorControllerSetter(null);
    return;
  }
  const meta = await inspectServiceWorker(serviceWorkerAPI.controller);
  navigatorControllerSetter({ meta });
};
applyControllerEffect();
if (canUseServiceWorkers) {
  serviceWorkerAPI.addEventListener("controllerchange", applyControllerEffect);
}
export { navigatorControllerRef };
