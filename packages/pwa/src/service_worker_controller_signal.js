import { serviceWorkerAPI } from "./internal/service_worker_api.js"
import { inspectServiceWorker } from "./internal/service_worker_communication.js"

const createSignalController = (initialValue) => {
  const channel = createChannel()
  const signal = createSignal(initialValue, channel)
  return [signal, channel]
}

const createSignal = (initialValue, channel) => {
  let value = initialValue

  return {
    get value() {
      return value
    },
    set value(newValue) {
      if (value !== newValue) {
        value = newValue
        channel.post(newValue)
      }
    },
    effect: (callback) => {
      callback(value)
      return channel.listen(callback)
    },
  }
}

const createChannel = () => {
  const callbackSet = new Set()
  return {
    listen: (callback) => {
      callbackSet.add(callback)
      return () => {
        callbackSet.delete(callback)
      }
    },
    post: (value) => {
      callbackSet.forEach((callback) => {
        callback(value)
      })
    },
  }
}

const [controllerSignal] = createSignalController(null)
const applyControllerEffect = async () => {
  const { controller } = serviceWorkerAPI
  if (controller) {
    const controllerScriptMeta = await inspectServiceWorker(
      serviceWorkerAPI.controller,
    )
    controllerSignal.value = {
      scriptMeta: controllerScriptMeta,
    }
  } else {
    controllerSignal.value = null
  }
}
applyControllerEffect()
serviceWorkerAPI.addEventListener("controllerchange", applyControllerEffect)
export const serviceWorkerControllerSignal = controllerSignal
