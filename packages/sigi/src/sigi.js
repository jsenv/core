/*
 * https://github.com/preactjs/signals/blob/main/packages/core/src/index.ts
 * TODO:
 * - respecter preventExtensions (et aussi pas besoin de le repréciser dans mutate, le state initial
 * sert de modele)
 * - mettre a jour rootStateObject histoire d'etre cohérent
 * (pourra aussi servir a lire le state sans subscribe)
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
  // - it register dynamically callback dependencies thanks to a custon handler
  //   called when a property is accessed
  // - it ensure state cannot be mutated from outside (throw when trying to set/define/delete
  //   a property
  const rootStateProxy = createStateProxy(rootPropertiesMetaMap)
  mutateValues({
    propertiesMetaMap: rootPropertiesMetaMap,
    toValues: rootStateObject,
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
        propertiesMetaMap: rootPropertiesMetaMap,
        toValues,
      })
    })
  }

  return {
    state: rootStateProxy,
    mutate,
    subscribe,
  }
}

const mutateValues = ({ propertiesMetaMap, toValues, initial, trace }) => {
  const keys = Object.keys(toValues)
  let i = 0
  const j = keys.length
  while (i < j) {
    const key = keys[i]
    i++
    if (isDev) {
      trace = trace ? [...trace, key] : [key]
    }
    const propertyToValue = toValues[key]
    const propertyMeta = propertiesMetaMap.get(key)
    const fromUnset = !propertyMeta
    const fromSet = Boolean(propertyMeta)
    const fromObject = fromSet && Boolean(propertyMeta.proxy)
    const fromPrimitive = fromSet && !fromObject
    const toObject = isObject(propertyToValue)
    const toPrimitive = !toObject

    // warn when property type changes (dev only)
    if (fromSet && isDev) {
      const propertyFromValue = propertyMeta.proxy
        ? propertyMeta.proxy
        : propertyMeta.signal.peek()
      // it's ok for PLACEHOLDER to go from undefined to something else
      if (propertyFromValue !== PLACEHOLDER) {
        const propertyFromValueType = typeof propertyFromValue
        const propertyToValueType = typeof propertyToValue
        if (propertyFromValueType !== propertyToValueType) {
          console.warn(
            `A value type will change from "${propertyFromValueType}" to "${propertyToValueType}" at state.${trace.join(
              ".",
            )}`,
          )
        }
      }
    }

    // from unset to object
    if (fromUnset && toObject) {
      const childPropertiesMetaMap = new Map()
      const childProxy = createStateProxy(childPropertiesMetaMap)
      propertiesMetaMap.set(key, {
        proxy: childProxy,
        propertiesMetaMap: childPropertiesMetaMap,
      })
      mutateValues({
        propertiesMetaMap: childPropertiesMetaMap,
        toValues: propertyToValue,
        initial,
        trace,
      })
      return
    }
    // from unset to primitive
    if (fromUnset && toPrimitive) {
      propertiesMetaMap.set(key, {
        signal: signal(propertyToValue),
      })
      return
    }
    // from object to object
    if (fromObject && toObject) {
      mutateValues({
        propertiesMetaMap: propertyMeta.propertiesMetaMap,
        toValues: propertyToValue,
        initial,
        trace,
      })
      return
    }
    // from object to primitive
    if (fromObject && toPrimitive) {
      propertiesMetaMap.set(key, {
        signal: signal(propertyToValue),
      })
      return
    }
    // from primitive to object
    if (fromPrimitive && toObject) {
      const childPropertiesMetaMap = new Map()
      const childProxy = createStateProxy(childPropertiesMetaMap)
      propertiesMetaMap.set(key, {
        proxy: childProxy,
        propertiesMetaMap: childPropertiesMetaMap,
      })
      mutateValues({
        propertiesMetaMap: childPropertiesMetaMap,
        toValues: propertyToValue,
        initial,
        trace,
      })
      return
    }
    // from primitive to primitive
    propertyMeta.signal.value = propertyToValue
  }
}

const PLACEHOLDER = Symbol.for("signal_placeholder")

const createStateProxy = (propertiesMetaMap) => {
  const target = {}
  const stateProxy = new Proxy(target, {
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
  Object.preventExtensions(stateProxy)
  return stateProxy
}

const isObject = (value) => {
  return value !== null && typeof value === "object"
}
