export const objectMapKey = (object, callback) => {
  const mappedObject = {}

  Object.keys(object).forEach((key) => {
    mappedObject[callback(key)] = object[key]
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
