export const composeTwoObjects = (first, second, composerMap) => {
  const composed = {}

  const firstKeys = Object.keys(first)
  const secondKeys = Object.keys(second)
  Object.keys(first).forEach((key) => {
    composed[key] = secondKeys.includes(key)
      ? composeTwoValues(first[key], second[key], composerMap[key])
      : first[key]
  })
  Object.keys(second).forEach((key) => {
    if (!firstKeys.includes(key)) {
      composed[key] = second[key]
    }
  })

  return composed
}

const composeTwoValues = (firstValue, secondValue, composer) => {
  if (composer) {
    return composer(firstValue, secondValue)
  }
  return secondValue
}
