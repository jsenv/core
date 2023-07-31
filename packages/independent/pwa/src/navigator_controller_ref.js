import { sigref } from "@jsenv/sigi";

import {
  serviceWorkerAPI,
  canUseServiceWorkers,
} from "./internal/service_worker_api.js";
import { inspectServiceWorker } from "./internal/service_worker_communication.js";

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
