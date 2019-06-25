import { createObservable } from "../observable/index.js"

export const valueToObservable = (value) => {
  return createObservable({
    subscribe: ({ next, complete }) => {
      next(value)
      complete()
      return {
        unsubscribe: () => {},
      }
    },
  })
}
