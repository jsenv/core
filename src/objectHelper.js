export const objectMapKey = (object, callback) => {
  const mappedObject = {}

  Object.keys(object).forEach((key) => {
    mappedObject[callback(key)] = object[key]
  })

  return mappedObject
}

export const objectMapValue = (object, callback) => {
  const mappedObject = {}

  Object.keys(object).forEach((key) => {
    mappedObject[key] = callback(object[key])
  })

  return mappedObject
}

export const objectMap = (object, callback) => {
  const mappedObject = {}

  Object.keys(object).forEach((key) => {
    Object.assign(mappedObject, callback(key, object[key], object))
  })

  return mappedObject
}

export const ojectFilter = (object, callback) => {
  const filteredObject = {}

  Object.keys(object).forEach((key) => {
    const value = object[key]
    if (callback(key, value, object)) {
      filteredObject[key] = value
    }
  })

  return filteredObject
}

export const objectComposeValue = (previous, object, callback) => {
  const composedObject = {}

  Object.keys(object).forEach((key) => {
    const value = object[key]
    composedObject[key] = key in previous ? callback(value, previous[key]) : value
  })

  return composedObject
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

export const composeMapToCompose = (composeMap) => {
  const composeReducer = composeMapToReducer(composeMap)
  return (...objects) => {
    return objects.reduce(composeReducer, {})
  }
}
