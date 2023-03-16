/*
 * https://github.com/preactjs/signals/blob/main/packages/core/src/index.ts
 * TOOD: "fix" array being objects
 */

import { signal, effect, batch } from "@preact/signals"

const isDev =
  import.meta.hot ||
  import.meta.dev ||
  (typeof process === "object" &&
    process.execArgv.includes("--conditions=development"))

export const sigi = (rootStateObject, { strict = false } = {}) => {
  if (!isObject(rootStateObject)) {
    throw new Error(
      `sigi first argument must be a basic object, got ${rootStateObject}`,
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
  const isExtensible = Object.isExtensible(rootStateObject)
  mutateValues({
    toValues: rootStateObject,
    propertiesMetaMap: rootPropertiesMetaMap,
    stateObject: rootStateObject,
    isExtensible: true,
    strict: false,
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
        isExtensible,
        strict,
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
  isExtensible,
  strict,
  trace,
}) => {
  const propertyNames = Object.getOwnPropertyNames(toValues)
  let i = 0
  const j = propertyNames.length
  while (i < j) {
    const propertyName = propertyNames[i]
    const propertyDescriptor = Object.getOwnPropertyDescriptor(
      toValues,
      propertyName,
    )
    i++
    if (propertyDescriptor.get || propertyDescriptor.set) {
      throw new Error(
        `Cannot set "${propertyName}", property must not use getter/setter`,
      )
    }
    if (!propertyDescriptor.configurable) {
      throw new Error(
        `Cannot set "${propertyName}", property must be configurable`,
      )
    }
    if (!propertyDescriptor.enumerable) {
      throw new Error(
        `Cannot set "${propertyName}", property must be enumerable`,
      )
    }
    if (!propertyDescriptor.writable) {
      throw new Error(`Cannot set "${propertyName}", property must be writable`)
    }
    if (isDev) {
      trace = trace ? [...trace, propertyName] : [propertyName]
    }

    const existingPropertyMeta = propertiesMetaMap.get(propertyName)
    const fromUnset = !existingPropertyMeta
    const fromSet = Boolean(existingPropertyMeta)
    const fromValue = fromSet ? existingPropertyMeta.signal.peek() : undefined
    const fromObject = fromSet && existingPropertyMeta.type === "object"
    const fromPrimitive = fromSet && !fromObject
    const toValue = propertyDescriptor.value
    const toObject = isObject(toValue)
    const toPrimitive = !toObject

    // warn when property type changes (dev only)
    if (
      fromSet &&
      isDev &&
      strict &&
      // it's ok for PLACEHOLDER to go from undefined to something else
      fromValue !== PLACEHOLDER
    ) {
      const fromValueType = fromValue === null ? "null" : typeof fromValue
      const toValueType = toValue === null ? "null" : typeof toValue
      if (fromValueType !== toValueType) {
        console.warn(
          `A value type will change from "${fromValueType}" to "${toValueType}" at state.${trace.join(
            ".",
          )}`,
        )
      }
    }
    if (fromUnset && !isExtensible) {
      throw new Error(
        `Cannot add property "${propertyName}", state is not extensible`,
      )
    }

    // from unset to object
    if (fromUnset && toObject) {
      const childPropertiesMetaMap = new Map()
      const childProxy = createStateProxy(toValue, childPropertiesMetaMap)
      const childIsExtensible = Object.isExtensible(toValue)
      const propertyMeta = {
        type: "object",
        signal: signal(childProxy),
        propertiesMetaMap: childPropertiesMetaMap,
        isExtensible: childIsExtensible,
      }
      propertiesMetaMap.set(propertyName, propertyMeta)
      mutateValues({
        toValues: toValue,
        propertiesMetaMap: childPropertiesMetaMap,
        stateObject: toValue,
        isExtensible: true,
        strict,
        trace,
      })
      stateObject[propertyName] = toValue
      continue
    }
    // from unset to primitive
    if (fromUnset && toPrimitive) {
      const propertyMeta = {
        type: "primitive",
        signal: signal(toValue),
        propertiesMetaMap: null,
        isExtensible: null,
      }
      propertiesMetaMap.set(propertyName, propertyMeta)
      stateObject[propertyName] = toValue
      continue
    }
    // from object to object
    if (fromObject && toObject) {
      mutateValues({
        toValues: toValue,
        propertiesMetaMap: existingPropertyMeta.propertiesMetaMap,
        stateObject: stateObject[propertyName],
        isExtensible: existingPropertyMeta.isExtensible,
        strict,
        trace,
      })
      continue
    }
    // from object to primitive
    if (fromObject && toPrimitive) {
      existingPropertyMeta.type = "primitive"
      existingPropertyMeta.signal.value = toValue
      existingPropertyMeta.propertiesMetaMap = null
      existingPropertyMeta.isExtensible = null
      stateObject[propertyName] = toValue
      continue
    }
    // from primitive to object
    if (fromPrimitive && toObject) {
      const childPropertiesMetaMap = new Map()
      const childProxy = createStateProxy(toValue, childPropertiesMetaMap)
      const childIsExtensible = Object.isExtensible(toValue)
      existingPropertyMeta.type = "object"
      existingPropertyMeta.signal.value = childProxy
      existingPropertyMeta.propertiesMetaMap = childPropertiesMetaMap
      existingPropertyMeta.isExtensible = childIsExtensible
      mutateValues({
        toValues: toValue,
        propertiesMetaMap: childPropertiesMetaMap,
        stateObject: toValue,
        isExtensible: true,
        strict,
        trace,
      })
      stateObject[propertyName] = toValue
      continue
    }
    // from primitive to primitive
    existingPropertyMeta.signal.value = toValue
    stateObject[propertyName] = toValue
  }
}

const PLACEHOLDER = Symbol.for("signal_placeholder")

const createStateProxy = (stateObject, propertiesMetaMap) => {
  const isExtensible = Object.isExtensible(stateObject)
  const stateProxy = new Proxy(stateObject, {
    // has is not required, we can use the original state
    // has: (_, key) => {},
    // same for getOwnPropertyDescriptor, let's just return the original descriptor
    // getOwnPropertyDescriptor: (_, key) => {
    //   const propertyMeta = propertiesMetaMap.get(key)
    //   if (!propertyMeta) {
    //     return undefined
    //   }
    //   const propertyProxy = propertyMeta.proxy
    //   if (propertyProxy) {
    //     return {
    //       value: propertyProxy,
    //       writable: true,
    //       configurable: true,
    //       enumerable: true,
    //     }
    //   }
    //   const propertySignal = propertyMeta.signal
    //   const value = propertySignal.value
    //   if (value === PLACEHOLDER) {
    //     return undefined
    //   }
    //   return {
    //     value,
    //     writable: true,
    //     configurable: true,
    //     enumerable: true,
    //   }
    // },
    get: (_, key) => {
      let propertyMeta = propertiesMetaMap.get(key)
      if (!propertyMeta) {
        if (!isExtensible) {
          if (isDev) {
            console.warn(
              `no property named "${key}" exists on state and state is not extensible`,
            )
          }
          return undefined
        }
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

const getPreciseType = (value) => {
  if (value === null) {
    return "null"
  }
  if (value === undefined) {
    return "undefined"
  }
  const type = typeof value
  if (type === "object") {
    const toStringResult = toString.call(value)
    // returns format is '[object ${tagName}]';
    // and we want ${tagName}
    const tagName = toStringResult.slice("[object ".length, -1)
    if (tagName === "Object") {
      if (!value.constructor) return "object" // Object.create(null)
      const objectConstructorName = value.constructor.name
      if (objectConstructorName === "Object") {
        return "object"
      }
      return objectConstructorName
    }
    return tagName
  }
  return type
}
const { toString } = Object.prototype

const isObject = (value) => {
  return getPreciseType(value) === "object"
}
