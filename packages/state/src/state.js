// https://github.com/preactjs/signals/blob/main/packages/core/src/index.ts

import { signal, computed, effect } from "@preact/signals"

export const createStructuredStateManager = (valueAtStart, debug = false) => {
  if (debug) {
    console.debug("value at start", valueAtStart)
  }

  const proxify = (valueSignal, ancestorSetter) => {
    const value = valueSignal.peek()
    if (typeof value !== "object" || value === null) {
      // ideally we should handle functions but there should be no function in state
      // as state is data
      return value
    }
    const proxy = {}
    Object.keys(value).forEach((key) => {
      const propertyOwnerAtStart = value
      let propertyOwner = propertyOwnerAtStart
      const propertyValueAtStart = value[key]
      let propertyValue = propertyValueAtStart
      const propertyValueSignal = computed(() => valueSignal.value[key])
      const propertySetter = (propertyValueToSet) => {
        if (propertyValueToSet !== propertyValue) {
          if (debug) {
            console.log(
              `set "${key}" =`,
              propertyValueToSet,
              `on`,
              propertyOwner,
            )
          }
          const propertyOwnerNext = { ...propertyOwner }
          propertyOwnerNext[key] = propertyValueToSet
          if (ancestorSetter) {
            ancestorSetter(propertyOwnerNext)
          } else {
            valueSignal.value = propertyOwnerNext
          }
          propertyOwner = propertyOwnerNext
          propertyValue = propertyValueToSet
        }
      }
      const propertyValueProxy = proxify(propertyValueSignal, propertySetter)
      const propertyGetter =
        propertyValueProxy === propertyValueAtStart
          ? () => {
              if (debug) {
                console.debug(
                  `get "${key}" on`,
                  propertyOwner,
                  `->`,
                  propertyValueSignal.value,
                )
              }
              return propertyValueSignal.value
            }
          : () => {
              if (debug) {
                console.debug(
                  `get "${key}" on`,
                  propertyOwner,
                  `->`,
                  propertyValueProxy,
                )
              }
              // eslint-disable-next-line no-unused-expressions
              propertyValueSignal.value
              return propertyValueProxy
            }

      Object.defineProperty(proxy, key, {
        enumerable: true,
        configurable: false,
        get: propertyGetter,
        set: propertySetter,
      })
    })
    return proxy
  }
  const stateSignal = signal(valueAtStart)
  const stateProxy = proxify(stateSignal)

  return stateProxy
}

export const onChange = (proxy, callback) => {
  return effect(() => {
    callback(proxy)
  })
}
