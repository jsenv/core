import { timeStart } from "./server_timing/timing_measure.js"

const HOOK_NAMES = [
  "serverListening",
  "redirectRequest",
  "produceResponse",
  "onResponsePush",
  "injectResponseHeaders",
  "responseReady",
  "serverStopped",
]

export const createServiceController = (services) => {
  const flatServices = flattenAndFilterServices(services)
  const hookGroups = {}
  const addHook = (hookName) => {
    const hooks = []
    flatServices.forEach((service) => {
      const hook = service[hookName]
      if (hook) {
        hooks.push({
          service,
          hookName,
          value: hook,
        })
      }
    })
    hookGroups[hookName] = hooks
    return hooks
  }
  HOOK_NAMES.forEach((hookName) => {
    addHook(hookName)
  })

  let currentService = null
  let currentHookName = null
  const callHook = (hook, info, context) => {
    const hookFn = hook.value
    if (!hookFn) {
      return null
    }
    currentService = hook.service
    currentHookName = hook.hookName
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
    currentHookName = hook.hookName
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
    for (const hook of hooks) {
      const returnValue = callHook(hook, info, context)
      if (returnValue) {
        callback(returnValue)
      }
    }
  }
  //   const callAsyncHooks = async (hookName, context, callback) => {
  //     const hooks = hookGroups[hookName]
  //     await hooks.reduce(async (previous, hook) => {
  //       await previous
  //       const returnValue = await callAsyncHook(hook, context)
  //       if (returnValue && callback) {
  //         await callback(returnValue)
  //       }
  //     }, Promise.resolve())
  //   }
  const callHooksUntil = (
    hookName,
    info,
    context,
    until = (returnValue) => returnValue,
  ) => {
    const hooks = hookGroups[hookName]
    for (const hook of hooks) {
      const returnValue = callHook(hook, info, context)
      const untilReturnValue = until(returnValue)
      if (untilReturnValue) {
        return untilReturnValue
      }
    }
    return null
  }
  const callAsyncHooksUntil = (hookName, info, context) => {
    const hooks = hookGroups[hookName]
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
    // callAsyncHooks,
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
