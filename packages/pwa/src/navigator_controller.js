import { sigi } from "@jsenv/sigi"

import { serviceWorkerAPI } from "./internal/service_worker_api.js"
import { inspectServiceWorker } from "./internal/service_worker_communication.js"

const { state, subscribe, mutate } = sigi({
  current: {
    meta: null,
  },
})

const applyControllerEffect = async () => {
  const { controller } = serviceWorkerAPI
  if (controller) {
    const meta = await inspectServiceWorker(serviceWorkerAPI.controller)
    mutate({ current: { meta } })
  } else {
    mutate({ current: null })
  }
}
applyControllerEffect()
serviceWorkerAPI.addEventListener("controllerchange", applyControllerEffect)
export const navigatorController = {
  get current() {
    return state.current
  },
  subscribe: (callback) => {
    subscribe(() => {
      callback(state.current)
    })
  },
}
