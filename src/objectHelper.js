export const objectMapKey = (object, callback) => {
  const mapped = {}

  Object.keys(object).forEach((key) => {
    mapped[callback(key)] = object[key]
  })

  return mapped
}

export const objectMapValue = (object, callback) => {
  const mapped = {}

  Object.keys(object).forEach((key) => {
    mapped[key] = callback(object[key])
  })

  return mapped
}

export const objectMap = (object, callback) => {
  const mapped = {}

  Object.keys(object).forEach((key) => {
    Object.assign(mapped, callback(key, object[key], object))
  })

  return mapped
}

export const ojectFilter = (object, callback) => {
  const filtered = {}

  Object.keys(object).forEach((key) => {
    const value = object[key]
    if (callback(key, value, object)) {
      filtered[key] = value
    }
  })

  return filtered
}

export const objectComposeValue = (previous, object, callback) => {
  const composed = { ...previous }

  Object.keys(object).forEach((key) => {
    composed[key] = key in composed ? callback(composed[key], object[key]) : object[key]
  })

  return composed
}

const composeMapToKeyComposer = (composeMap) => (key, object, nextObject) => {
  if (key in object === false) {
    return nextObject[key]
  }

  if (key in composeMap === false) {
    return nextObject[key]
  }

  return composeMap[key](object[key], nextObject[key])
}

const keyComposerToReducer = (keyComposer) => {
  return (previous, object) => {
    if (typeof object !== "object" || object === null) {
      return { ...previous }
    }

    const composed = { ...previous }
    Object.keys(object).forEach((key) => {
      composed[key] = keyComposer(key, previous, object)
    })
    return composed
  }
}

const composeMapToReducer = (composeMap) => {
  return keyComposerToReducer(composeMapToKeyComposer(composeMap))
}

export const composeMapToCompose = (composeMap, createInitial = () => ({})) => {
  const composeReducer = composeMapToReducer(composeMap)
  return (...objects) => {
    return objects.reduce(composeReducer, createInitial())
  }
}
