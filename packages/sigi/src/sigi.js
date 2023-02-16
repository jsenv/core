// https://github.com/preactjs/signals/blob/main/packages/core/src/index.ts

import { signal, effect, batch } from "@preact/signals"

const isDev =
  import.meta.hot ||
  import.meta.dev ||
  (typeof process === "object" &&
    process.execArgv.includes("--conditions=development"))

export const sigi = (values) => {
  if (!isObject(values)) {
    throw new Error(`sigi first argument must be an object, got ${values}`)
  }

  // les signals c'est ce qu'on voudras accéder de l'extérieur
  // mais il faut aussi un moyen de set la valeur associée
  const proxies = {}
  const signals = {}
  const proxy = createStateProxy(proxies, signals)
  const fromValues = {}
  mutateValues({
    proxies,
    signals,
    proxy,
    fromValues,
    toValues: values,
  })

  const subscribe = (callback) => {
    return effect(() => {
      callback(proxy)
    })
  }

  const mutate = (toValues) => {
    batch(() => {
      mutateValues({
        proxies,
        signals,
        proxy,
        fromValues,
        toValues,
      })
    })
  }

  return {
    state: proxy,
    mutate,
    subscribe,
  }
}

const PLACEHOLDER = Symbol.for("signal_placeholder")

const createStateProxy = (proxies, signals) => {
  const target = {}
  const stateProxy = new Proxy(target, {
    getOwnPropertyDescriptor: (target, key) => {
      if (Object.hasOwn(signals, key)) {
        return Object.getOwnPropertyDescriptor(signals, key)
      }
      return null
    },
    get: (target, key) => {
      if (!Object.hasOwn(signals, key)) {
        const propertySignal = signal(PLACEHOLDER)
        signals[key] = propertySignal
        // eslint-disable-next-line no-unused-expressions
        propertySignal.value
        return undefined
      }
      const proxy = proxies[key]
      if (proxy) {
        return proxy
      }
      return signals[key].value
    },
    set: () => {
      throw new Error(`state cannot be mutated`)
    },
  })
  Object.preventExtensions(stateProxy)
  return stateProxy
}

const mutateValues = ({ proxies, signals, proxy, toValues, trace }) => {
  const keys = Object.keys(toValues)
  let i = 0
  const j = keys.length
  while (i < j) {
    const key = keys[i]
    i++
    if (isDev) {
      trace = trace ? [...trace, key] : [key]
    }
    const toValue = toValues[key]
    if (Object.hasOwn(signals, key)) {
      if (isDev) {
        const propertySignal = signals[key]
        const fromValue = isPlainObject(propertySignal)
          ? propertySignal
          : propertySignal.peek()
        if (fromValue !== PLACEHOLDER) {
          const fromType = typeof fromValue
          const toType = typeof toValue
          if (fromType !== toType) {
            console.warn(
              `A value type will change from "${fromType}" to "${toType}" at state.${trace.join(
                ".",
              )}`,
            )
          }
        }
      }
      if (isObject(toValue)) {
        mutateValues({
          proxies: proxies[key],
          signals: signals[key],
          proxy: proxy[key],
          toValues: toValue,
          trace,
        })
      } else {
        signals[key].value = toValue
      }
    } else {
      if (!Object.isExtensible({})) {
        throw new TypeError(
          `Cannot define property ${key}, object is not extensible`,
        )
      }
      if (isObject(toValue)) {
        const childProxies = {}
        const childSignals = {}
        const childProxy = createStateProxy(childProxies, childSignals)
        const childFromValues = {}
        proxies[key] = childProxy
        signals[key] = childSignals

        mutateValues({
          proxies: childProxies,
          proxy: childProxy,
          signals: childSignals,
          fromValues: childFromValues,
          toValues: toValue,
          trace,
        })
        if (!Object.isExtensible(toValue)) {
          Object.preventExtensions(childSignals)
          Object.preventExtensions(childFromValues)
        }
      } else {
        signals[key] = signal(toValue)
      }
    }
  }
}

const isPlainObject = (value) => {
  return value && Object.getPrototypeOf(value) === Object.prototype
}

const isObject = (value) => {
  return value !== null && typeof value === "object"
}
