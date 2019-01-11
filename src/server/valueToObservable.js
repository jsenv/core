import { subscribeToObservable } from "../observable/index.js"

export const valueToObservable = (value) => {
  return subscribeToObservable(({ next, complete }) => {
    next(value)
    complete()
    return {
      unsubscribe: () => {},
    }
  })
}
