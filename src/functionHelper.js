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

export const memoizeOnce = (compute) => {
  let locked = false
  let lockValue

  const memoized = (...args) => {
    if (locked) return lockValue
    // if compute is recursive wait for it to be fully done before storing the lockValue
    // so set locked later
    lockValue = compute(...args)
    locked = true
    return lockValue
  }

  memoized.deleteCache = () => {
    const value = lockValue
    locked = false
    lockValue = undefined
    return value
  }

  return memoized
}

export const memoizeReturn = (compute) => {
  let locked
  let lockValue

  return (...args) => {
    if (locked) {
      return lockValue
    }
    locked = true

    let promiseResolve
    // well in case compute is recursive, we ensure lockValue
    // returns the right promise
    lockValue = new Promise((resolve) => {
      promiseResolve = resolve
    })
    Promise.resolve().then(() => {
      promiseResolve(compute(...args))
    })
    lockValue.then(() => {
      locked = false
    })

    return lockValue
  }
}

export const memoizeWhile = (compute, { opened, closed }) => {
  let locked
  let lockValue

  opened(() => {
    locked = true
  })
  closed(() => {
    locked = false
  })

  return (...args) => {
    if (locked) {
      return lockValue
    }

    let promiseResolve
    lockValue = new Promise((resolve) => {
      promiseResolve = resolve
    })
    Promise.resolve().then(() => {
      promiseResolve(compute(...args))
    })
    lockValue.then(() => {
      locked = false
    })

    return lockValue
  }
}
