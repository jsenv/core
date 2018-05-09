import { passed, failed } from "@dmail/action"

export const memoize = (fn, { restore, save, transform = (value) => value }) => {
  return (...args) => {
    return passed(restore(...args)).then(
      (value) => transform(value, ...args),
      () => {
        const freshValue = fn(...args)
        save(freshValue, ...args)
        return passed(transform(freshValue, ...args))
      },
    )
  }
}

export const createStore = ({
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
}) => {
  const entries = []

  const restore = (...args) => {
    const foundEntry = entries.find(({ savedArgs }) => compare(args, savedArgs))
    return foundEntry ? passed(foundEntry.value) : failed()
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
  }
}

export const memoizeSync = (
  fn,
  { restore, save, transform = (value) => value } = createStore(),
) => {
  return (...args) => {
    const restoreAction = passed(restore(...args))
    const restoreState = restoreAction.getState()
    if (restoreState === "passed") {
      return transform(restoreAction.getResult(), ...args)
    }
    if (restoreState === "failed") {
      const freshValue = fn(...args)
      save(freshValue, ...args)
      return transform(freshValue, ...args)
    }
    throw new Error("restore must pass/fail synchronously")
  }
}
