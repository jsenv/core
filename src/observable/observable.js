if ("observable" in Symbol === false) {
  Symbol.observable = Symbol.for("observable")
}

export const subscribeToObservable = (subscribe) => {
  const observable = {
    [Symbol.observable]: () => {
      const hooks = {
        subscribe,
        [Symbol.observable]: () => hooks,
      }
      return hooks
    },
  }
  return observable
}

export const subscribe = (
  observableObject,
  {
    next = () => {},
    error = (value) => {
      throw value
    },
    complete = () => {},
  },
) => {
  const { subscribe } = observableObject[Symbol.observable]()
  const subscription = subscribe({
    next,
    error,
    complete,
  })
  return subscription
}

export const isObservable = (value) => {
  if (value === null) return false
  if (value === undefined) return false
  if (typeof value === "object") return Symbol.observable in value
  if (typeof value === "function") return Symbol.observable in value
  return false
}
