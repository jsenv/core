import { sigref } from "@jsenv/sigi"

import { serviceWorkerAPI } from "./internal/service_worker_api.js"
import { inspectServiceWorker } from "./internal/service_worker_communication.js"

const [navigatorControllerRef, navigatorControllerSetter] = sigref(null)

const applyControllerEffect = async () => {
  const { controller } = serviceWorkerAPI
  if (controller) {
    const meta = await inspectServiceWorker(serviceWorkerAPI.controller)
    navigatorControllerSetter({ meta })
  } else {
    navigatorControllerSetter(null)
  }
}
applyControllerEffect()
serviceWorkerAPI.addEventListener("controllerchange", applyControllerEffect)
export { navigatorControllerRef }
