import { sigi } from "@jsenv/sigi"

import { serviceWorkerAPI } from "./internal/service_worker_api.js"
import { inspectServiceWorker } from "./internal/service_worker_communication.js"

const controllerSigi = sigi({
  current: null,
})

const applyControllerEffect = async () => {
  const { controller } = serviceWorkerAPI
  if (controller) {
    const meta = await inspectServiceWorker(serviceWorkerAPI.controller)
    controllerSigi.mutate({ current: { meta } })
  } else {
    controllerSigi.mutate({ current: null })
  }
}
applyControllerEffect()
serviceWorkerAPI.addEventListener("controllerchange", applyControllerEffect)
export const navigatorController = {
  get current() {
    return controllerSigi.state.current
  },
  subscribe: (callback) => {
    return controllerSigi.subscribe(() => {
      callback(controllerSigi.state.current)
    })
  },
}
