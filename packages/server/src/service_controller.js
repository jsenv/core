import { timeStart } from "./server_timing/timing_measure.js"

const HOOK_NAMES = [
  "serverListening",
  "redirectRequest",
  "handleRequest",
  "handleError",
  "onResponsePush",
  "injectResponseHeaders",
  "responseReady",
  "serverStopped",
]

export const createServiceController = (services) => {
  const flatServices = flattenAndFilterServices(services)
  const hookGroups = {}

  const addService = (service) => {
    Object.keys(service).forEach((key) => {
      if (key === "name") return
      const isHook = HOOK_NAMES.includes(key)
      if (!isHook) {
        console.warn(
          `Unexpected "${key}" property on "${service.name}" service`,
        )
      }
      const hookName = key
      const hookValue = service[hookName]
      if (hookValue) {
        const group = hookGroups[hookName] || (hookGroups[hookName] = [])
        group.push({
          service,
          name: hookName,
          value: hookValue,
        })
      }
    })
  }
  services.forEach((service) => {
    addService(service)
  })

  let currentService = null
  let currentHookName = null
  const callHook = (hook, info, context) => {
    const hookFn = hook.value
    if (!hookFn) {
      return null
    }
    currentService = hook.service
    currentHookName = hook.name
    let timeEnd
    if (context && context.timing) {
      timeEnd = timeStart(
        `${currentHookName}-${currentService.name.replace("jsenv:", "")}`,
      )
    }
    let valueReturned = hookFn(info, context)
    if (context && context.timing) {
      Object.assign(context.timing, timeEnd())
    }
    currentService = null
    currentHookName = null
    return valueReturned
  }
  const callAsyncHook = async (hook, info, context) => {
    const hookFn = hook.value
    if (!hookFn) {
      return null
    }
    currentService = hook.service
    currentHookName = hook.name
    let timeEnd
    if (context && context.timing) {
      timeEnd = timeStart(
        `${currentHookName}-${currentService.name.replace("jsenv:", "")}`,
      )
    }
    let valueReturned = await hookFn(info, context)
    if (context && context.timing) {
      Object.assign(context.timing, timeEnd())
    }
    currentService = null
    currentHookName = null
    return valueReturned
  }

  const callHooks = (hookName, info, context, callback = () => {}) => {
    const hooks = hookGroups[hookName]
    if (hooks) {
      for (const hook of hooks) {
        const returnValue = callHook(hook, info, context)
        if (returnValue) {
          callback(returnValue)
        }
      }
    }
  }
  const callHooksUntil = (
    hookName,
    info,
    context,
    until = (returnValue) => returnValue,
  ) => {
    const hooks = hookGroups[hookName]
    if (hooks) {
      for (const hook of hooks) {
        const returnValue = callHook(hook, info, context)
        const untilReturnValue = until(returnValue)
        if (untilReturnValue) {
          return untilReturnValue
        }
      }
    }
    return null
  }
  const callAsyncHooksUntil = (hookName, info, context) => {
    const hooks = hookGroups[hookName]
    if (!hooks) {
      return null
    }
    if (hooks.length === 0) {
      return null
    }
    return new Promise((resolve, reject) => {
      const visit = (index) => {
        if (index >= hooks.length) {
          return resolve()
        }
        const hook = hooks[index]
        const returnValue = callAsyncHook(hook, info, context)
        return Promise.resolve(returnValue).then((output) => {
          if (output) {
            return resolve(output)
          }
          return visit(index + 1)
        }, reject)
      }
      visit(0)
    })
  }

  return {
    services: flatServices,

    callHooks,
    callHooksUntil,
    callAsyncHooksUntil,

    getCurrentService: () => currentService,
    getCurrentHookName: () => currentHookName,
  }
}

const flattenAndFilterServices = (services) => {
  const flatServices = []
  const visitServiceEntry = (serviceEntry) => {
    if (Array.isArray(serviceEntry)) {
      serviceEntry.forEach((value) => visitServiceEntry(value))
      return
    }
    if (typeof serviceEntry === "object" && serviceEntry !== null) {
      if (!serviceEntry.name) {
        serviceEntry.name = "anonymous"
      }
      flatServices.push(serviceEntry)
      return
    }
    throw new Error(`services must be objects, got ${serviceEntry}`)
  }
  services.forEach((serviceEntry) => visitServiceEntry(serviceEntry))
  return flatServices
}
