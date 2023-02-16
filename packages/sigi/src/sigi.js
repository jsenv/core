// https://github.com/preactjs/signals/blob/main/packages/core/src/index.ts

import { signal, effect, batch } from "@preact/signals"

const isDev =
  import.meta.hot ||
  import.meta.dev ||
  (typeof process === "object" &&
    process.execArgv.includes("--conditions=development"))

export const sigi = (valueAtStart) => {
  if (!isObject(valueAtStart)) {
    throw new Error(
      `sigi first argument must be an object, got ${valueAtStart}`,
    )
  }

  let stateToMutate
  const visitKeysToMutate = (object, trace = []) => {
    const keys = Object.keys(object)
    let i = 0
    const j = keys.length
    while (i < j) {
      const key = keys[i]
      i++
      const value = object[key]
      if (isObject(value)) {
        stateToMutate = stateToMutate[key]
        visitKeysToMutate(value, isDev ? [...trace, key] : null)
      } else {
        if (isDev) {
          warnOnTypeChange({
            object: stateToMutate,
            key,
            toValue: value,
            trace,
          })
        }
        stateToMutate[key] = value
      }
    }
  }

  const internalState = {}
  const externalState = {}
  const mutate = (mutationDescriptor) => {
    batch(() => {
      stateToMutate = internalState
      visitKeysToMutate(mutationDescriptor)
      stateToMutate = null
    })
  }
  const subscribe = (callback) => {
    return effect(() => {
      callback(externalState)
    })
  }

  let internalStateCurrent = internalState
  let externalStateCurrent = externalState
  const visitKeysToInit = (object) => {
    const keys = Object.keys(object)
    let i = 0
    const j = keys.length
    while (i < j) {
      const key = keys[i]
      i++
      const value = object[key]
      if (isObject(value)) {
        internalStateCurrent = internalStateCurrent[key] = {}
        externalStateCurrent = externalStateCurrent[key] = {}
        visitKeysToInit(value)
        if (!Object.isExtensible(value)) {
          Object.preventExtensions(internalStateCurrent)
          Object.preventExtensions(externalStateCurrent)
        }
      } else {
        const signalForThatValue = signal(value)
        Object.defineProperty(internalStateCurrent, key, {
          enumerable: true,
          configurable: false,
          get: () => signalForThatValue.peek(),
          set: (value) => {
            signalForThatValue.value = value
          },
        })
        // externalState is meant to be exposed to the outside
        // and we don't want code from outside to be able to mutate the state
        // so only has a getter
        Object.defineProperty(externalStateCurrent, key, {
          enumerable: true,
          configurable: false,
          get: () => signalForThatValue.value,
        })
      }
    }
  }
  visitKeysToInit(valueAtStart)
  if (!Object.isExtensible(valueAtStart)) {
    Object.preventExtensions(internalState)
    Object.preventExtensions(externalState)
  }
  internalStateCurrent = null
  externalStateCurrent = null

  return {
    internalState,
    externalState,
    mutate,
    subscribe,
  }
}

const warnOnTypeChange = ({ object, key, toValue, trace }) => {
  if (Object.hasOwn(object, key)) {
    const fromValue = object[key]
    const fromType = typeof fromValue
    const toType = typeof toValue
    if (fromType !== toType) {
      console.warn(
        `A value type will change from "${fromType}" to "${toType}" at state.${[
          ...trace,
          key,
        ].join(".")}`,
      )
    }
  }
}

const isObject = (value) => {
  return value !== null && typeof value === "object"
}
