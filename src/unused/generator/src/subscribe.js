// https://tc39.github.io/proposal-observable/
// https://github.com/tc39/proposal-observable/blob/0fa13995f372bab50de8cb5e8db59066ad08dd7a/src/Observable.js
// https://github.com/zenparsing/zen-observable/blob/master/src/Observable.js

export const subscribe = (generator, { start, next, error, done } = {}) => {
  if (typeof generator !== "function") {
    throw new TypeError(`subscribe generator must be a function, got ${generator}`)
  }

  let cleanup
  let closed = false

  if (start === undefined) {
  } else if (typeof start === "function") {
    start({
      unsubscribe: () => {
        closed = true
      },
    })
    if (closed) return undefined
  } else {
    throw new TypeError(`subscribe start must be a function, got ${start}`)
  }

  let nextHook
  if (next === undefined) {
    nextHook = () => undefined
  } else if (typeof next === "function") {
    nextHook = (value) => {
      if (closed) {
        return undefined
      }
      return next(value)
    }
  } else {
    throw new TypeError(`subscribe next must be a function, got ${next}`)
  }

  let doneHook
  if (done === undefined) {
    doneHook = () => {
      if (closed) return undefined
      closed = true
      if (cleanup) {
        return cleanup()
      }
      return undefined
    }
  } else if (typeof done === "function") {
    doneHook = () => {
      if (closed) return undefined
      closed = true
      if (cleanup) {
        cleanup()
      }
      return done()
    }
  } else {
    throw new TypeError(`subscribe done must be a function, got ${done}`)
  }

  let errorHook
  if (error === undefined) {
    errorHook = (value) => {
      throw value
    }
  } else if (typeof error === "function") {
    errorHook = (value) => {
      if (closed) {
        throw value
      }
      return error(value)
    }
  } else {
    throw new TypeError(`subscribe error must be a function, got ${error}`)
  }

  const generatorHooks = { next: nextHook, error: errorHook, done: doneHook }

  let returnValue
  if (error) {
    try {
      returnValue = generator(generatorHooks)
    } catch (e) {
      error(e)
    }
  } else {
    returnValue = generator(generatorHooks)
  }

  if (typeof returnValue === "function") {
    cleanup = returnValue
  }

  // in case done called sync inside generator
  if (closed) {
    if (cleanup) {
      cleanup()
    }
    return {
      closed: true,
      unsubscribe: () => undefined,
    }
  }

  return {
    get closed() {
      return closed
    },
    unsubscribe: () => {
      if (closed) return undefined
      closed = true
      if (cleanup) {
        return cleanup()
      }
      return undefined
    },
  }
}
