/*
 * https://github.com/preactjs/signals/blob/main/packages/core/src/index.ts
 * TODO:
 * - respecter preventExtensions (et aussi pas besoin de le repréciser dans mutate, le state initial
 * sert de modele)
 */

import { signal, effect, batch } from "@preact/signals"

const isDev =
  import.meta.hot ||
  import.meta.dev ||
  (typeof process === "object" &&
    process.execArgv.includes("--conditions=development"))

export const sigi = (rootStateObject) => {
  if (!isObject(rootStateObject)) {
    throw new Error(
      `sigi first argument must be an object, got ${rootStateObject}`,
    )
  }

  const rootPropertiesMetaMap = new Map()
  // stateProxy is the public way to interact with the state
  // - it register dependencies (of callbacks passed to subscribe) dynamically
  //   thanks to a get handler
  // - it ensure state cannot be mutated from outside (throw when trying to set/define/delete
  //   a property
  const rootStateProxy = createStateProxy(
    rootStateObject,
    rootPropertiesMetaMap,
  )
  mutateValues({
    toValues: rootStateObject,
    propertiesMetaMap: rootPropertiesMetaMap,
    stateObject: rootStateObject,
    initial: true,
  })

  const subscribe = (callback) => {
    return effect(() => {
      callback(rootStateProxy)
    })
  }

  const mutate = (toValues) => {
    batch(() => {
      mutateValues({
        toValues,
        propertiesMetaMap: rootPropertiesMetaMap,
        stateObject: rootStateObject,
      })
    })
  }

  return {
    state: rootStateProxy,
    mutate,
    subscribe,
  }
}

const mutateValues = ({
  toValues,
  propertiesMetaMap,
  stateObject,
  initial,
  trace,
}) => {
  const propertyNames = Object.keys(toValues)
  let i = 0
  const j = propertyNames.length
  while (i < j) {
    const propertyName = propertyNames[i]
    i++
    if (isDev) {
      trace = trace ? [...trace, propertyName] : [propertyName]
    }
    const toValue = toValues[propertyName]
    const propertyMeta = propertiesMetaMap.get(propertyName)
    const fromUnset = !propertyMeta
    const fromSet = Boolean(propertyMeta)
    const fromObject = fromSet && Boolean(propertyMeta.proxy)
    const fromPrimitive = fromSet && !fromObject
    const toObject = isObject(toValue)
    const toPrimitive = !toObject

    // warn when property type changes (dev only)
    if (fromSet && isDev) {
      const fromValue = propertyMeta.proxy
        ? propertyMeta.proxy
        : propertyMeta.signal.peek()
      // it's ok for PLACEHOLDER to go from undefined to something else
      if (fromValue !== PLACEHOLDER) {
        const fromValueType = typeof fromValue
        const toValueType = typeof toValue
        if (fromValueType !== toValueType) {
          console.warn(
            `A value type will change from "${fromValueType}" to "${toValueType}" at state.${trace.join(
              ".",
            )}`,
          )
        }
      }
    }

    // from unset to object
    if (fromUnset && toObject) {
      const childPropertiesMetaMap = new Map()
      const childProxy = createStateProxy(toValue, childPropertiesMetaMap)
      propertiesMetaMap.set(propertyName, {
        proxy: childProxy,
        propertiesMetaMap: childPropertiesMetaMap,
      })
      mutateValues({
        toValues: toValue,
        propertiesMetaMap: childPropertiesMetaMap,
        stateObject: toValue,
        initial,
        trace,
      })
      stateObject[propertyName] = toValue
      return
    }
    // from unset to primitive
    if (fromUnset && toPrimitive) {
      propertiesMetaMap.set(propertyName, {
        signal: signal(toValue),
      })
      stateObject[propertyName] = toValue
      return
    }
    // from object to object
    if (fromObject && toObject) {
      mutateValues({
        toValues: toValue,
        propertiesMetaMap: propertyMeta.propertiesMetaMap,
        stateObject: stateObject[propertyName],
        initial,
        trace,
      })
      return
    }
    // from object to primitive
    if (fromObject && toPrimitive) {
      propertiesMetaMap.set(propertyName, {
        signal: signal(toValue),
      })
      stateObject[propertyName] = toValue
      return
    }
    // from primitive to object
    if (fromPrimitive && toObject) {
      const childPropertiesMetaMap = new Map()
      const childProxy = createStateProxy(childPropertiesMetaMap)
      propertiesMetaMap.set(propertyName, {
        proxy: childProxy,
        propertiesMetaMap: childPropertiesMetaMap,
      })
      mutateValues({
        toValues: toValue,
        propertiesMetaMap: childPropertiesMetaMap,
        stateObject: toValue,
        initial,
        trace,
      })
      stateObject[propertyName] = toValue
      return
    }
    // from primitive to primitive
    propertyMeta.signal.value = toValue
    stateObject[propertyName] = toValue
  }
}

const PLACEHOLDER = Symbol.for("signal_placeholder")

const createStateProxy = (stateObject, propertiesMetaMap) => {
  const stateProxy = new Proxy(stateObject, {
    // has: (_, key) => {
    // },
    getOwnPropertyDescriptor: (_, key) => {
      const propertyMeta = propertiesMetaMap.get(key)
      if (propertyMeta) {
        return {
          value: propertyMeta.proxy
            ? propertyMeta.proxy
            : propertyMeta.signal.value,
          writable: false,
          configurable: false,
          enumerable: true,
        }
      }
      return null
    },
    get: (_, key) => {
      let propertyMeta = propertiesMetaMap.get(key)
      if (!propertyMeta) {
        const propertySignal = signal(PLACEHOLDER)
        propertyMeta = {
          signal: propertySignal,
        }
        propertiesMetaMap.set(key, propertyMeta)
        // eslint-disable-next-line no-unused-expressions
        propertySignal.value
        return undefined
      }
      // if there is a proxy it means it's an object
      const propertyProxy = propertyMeta.proxy
      if (propertyProxy) {
        return propertyProxy
      }
      // otherwise it's a primitive
      const propertySignal = propertyMeta.signal
      const propertyValue = propertySignal.value
      if (propertyValue === PLACEHOLDER) return undefined
      return propertyValue
    },
    defineProperty: (_, key) => {
      throw new Error(
        `Invalid attempt to define "${key}", cannot mutate state from outside`,
      )
    },
    deleteProperty: (_, key) => {
      throw new Error(
        `Invalid attempt to delete "${key}", cannot mutate state from outside`,
      )
    },
    set: (_, key) => {
      throw new Error(
        `Invalid attempt to set "${key}", cannot mutate state from outside`,
      )
    },
  })
  return stateProxy
}

const isObject = (value) => {
  return value !== null && typeof value === "object"
}
