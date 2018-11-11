// https://github.com/ReactiveX/rxjs/blob/master/src/internal/operators/share.ts
import { subscribe } from "./subscribe.js"

const arrayWithout = (array, item) => {
  const arrayWithoutItem = []
  let i = 0
  while (i < array.length) {
    const value = array[i]
    i++
    if (value === item) {
      continue
    }
    arrayWithoutItem[i] = value
  }
  return arrayWithoutItem
}

const previousCallCompose = (fn, secondFn) => (value) => {
  if (fn) {
    fn(value)
  }
  return secondFn(value)
}

export const share = (generator) => {
  let callCount = 0
  let nextCallbacks = []
  let errorCallbacks = []
  let doneCallbacks = []
  let sharedSubscription
  // We want the code below to work as describe in comment
  /*
  let callCount = 0
  const fooBarGenerator = ({ next }) => {
    callCount++
    next('foo')
    next('bar')
  })
  const generator = share(fooBarGenerator)
  subscribe(generator, {
    next: () => {} // 'called sync with 'foo' and 'bar'
  })
  subscribe(generator, {
    next: () => {} // 'called sync with 'foo' and 'bar'
  })
  callCount // mus be 1, the generator function is called once
  */
  // To do this, we use syncPreviousCalls below. It will be a function knowing the previous
  // calls to next, error, done made by generator
  // it store calls just before generator gets called and until a setTimeout resolves (a macrotask).
  // It means only synchronous calls to next, error, done are stored.
  // During this short period, next, error, done are called immediatly with previous calls

  let syncPreviousCalls

  const sharedGenerator = ({ next, error, done }) => {
    callCount++
    if (syncPreviousCalls) {
      const fn = syncPreviousCalls
      syncPreviousCalls = undefined
      fn({ next, error, done })
    }
    nextCallbacks.push(next)
    errorCallbacks.push(error)
    doneCallbacks.push(done)

    if (callCount === 1) {
      let storeCalls = true

      const sharedNext = (value) => {
        if (storeCalls) {
          syncPreviousCalls = previousCallCompose(syncPreviousCalls, ({ next }) => next(value))
        }
        return nextCallbacks.map((callback) => callback(value))
      }

      const sharedError = (value) => {
        if (errorCallbacks.length === 0) {
          throw value
        }
        if (storeCalls) {
          syncPreviousCalls = previousCallCompose(syncPreviousCalls, ({ error }) => error(value))
        }
        return errorCallbacks.map((callback) => callback(value))
      }

      const sharedDone = () => {
        if (storeCalls) {
          syncPreviousCalls = previousCallCompose(syncPreviousCalls, ({ done }) => done())
        }
        return doneCallbacks.map((callback) => callback())
      }

      sharedSubscription = subscribe(generator, {
        next: sharedNext,
        error: sharedError,
        done: sharedDone,
      })

      setTimeout(() => {
        storeCalls = false
        syncPreviousCalls = undefined
      })
    }

    return () => {
      nextCallbacks = arrayWithout(nextCallbacks, next)
      errorCallbacks = arrayWithout(errorCallbacks, error)
      doneCallbacks = arrayWithout(doneCallbacks, done)
      callCount--
      if (callCount === 0) {
        return sharedSubscription.unsubscribe()
      }
      return undefined
    }
  }

  return sharedGenerator
}
