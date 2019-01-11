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
    mapped[key] = callback(object[key], key, object)
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

export const objectFilter = (object, callback) => {
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

export const objectValues = (object) => {
  return Object.keys(object).map((key) => object[key])
}
