if ("observable" in Symbol === false) {
  Symbol.observable = Symbol.for("observable")
}

export const createObservable = ({ subscribe }) => {
  const observable = {
    [Symbol.observable]: () => observable,
    subscribe,
  }
  return observable
}

export const subscribe = (
  observable,
  {
    next = () => {},
    error = (value) => {
      throw value
    },
    complete = () => {},
  },
) => {
  const { subscribe } = observable[Symbol.observable]()
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
