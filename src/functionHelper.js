export const guard = (predicate, fn) => (...args) => {
  if (predicate(...args)) {
    return fn(...args)
  }
  return undefined
}

export const predicateCompose = (...predicates) => (...args) =>
  predicates.every((predicate) => predicate(...args))

export const createStore = (
  {
    compare = (args, savedArgs) => {
      if (savedArgs.length !== args.length) {
        return false
      }
      return savedArgs.every((savedArg, index) => {
        const arg = args[index]
        if (arg !== savedArg) {
          // should be a bit more powerfull to compare shallow here
          return false
        }
        return true
      })
    },
    maxLength = 100,
    transform = (v) => v,
  } = {},
) => {
  const entries = []

  const restore = (...args) => {
    const foundEntry = entries.find(({ savedArgs }) => compare(args, savedArgs))
    return {
      has: Boolean(foundEntry),
      value: foundEntry ? foundEntry.value : undefined,
    }
  }

  const save = (value, ...args) => {
    if (entries.length >= maxLength) {
      entries.shift()
    }
    entries.push({ value, savedArgs: args })
  }

  return {
    restore,
    save,
    transform,
  }
}

export const memoize = (fn, { restore, save, transform } = createStore()) => {
  return (...args) => {
    return Promise.resolve(restore(...args)).then(({ has, value }) => {
      if (has) {
        return transform(value, ...args)
      }
      const freshValue = fn(...args)
      save(freshValue, ...args)
      return transform(freshValue, ...args)
    })
  }
}

export const memoizeSync = (fn, { restore, save, transform } = createStore()) => {
  return (...args) => {
    const { has, value } = restore(...args)
    if (has) {
      return transform(value, ...args)
    }
    const freshValue = fn(...args)
    save(freshValue, ...args)
    return transform(freshValue, ...args)
  }
}

export const createOnceSignal = () => {
  const callbackSet = new Set()

  const register = (callback) => {
    callbackSet.add(callback)
    return () => {
      callbackSet.delete(callback)
    }
  }

  const getRegisteredCallbacks = () => {
    const callbacks = Array.from(callbackSet.values())
    callbackSet.clear()
    return callbacks
  }

  return { register, getRegisteredCallbacks }
}
