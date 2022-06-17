export const composeTwoObjects = (
  firstObject,
  secondObject,
  { keysComposition, strict = false, forceLowerCase = false } = {},
) => {
  if (forceLowerCase) {
    return applyCompositionForcingLowerCase(firstObject, secondObject, {
      keysComposition,
      strict,
    })
  }

  return applyCaseSensitiveComposition(firstObject, secondObject, {
    keysComposition,
    strict,
  })
}

const applyCaseSensitiveComposition = (
  firstObject,
  secondObject,
  { keysComposition, strict },
) => {
  if (strict) {
    const composed = {}
    Object.keys(keysComposition).forEach((key) => {
      composed[key] = composeValueAtKey({
        firstObject,
        secondObject,
        keysComposition,
        key,
        firstKey: keyExistsIn(key, firstObject) ? key : null,
        secondKey: keyExistsIn(key, secondObject) ? key : null,
      })
    })
    return composed
  }

  const composed = {}
  Object.keys(firstObject).forEach((key) => {
    composed[key] = firstObject[key]
  })
  Object.keys(secondObject).forEach((key) => {
    composed[key] = composeValueAtKey({
      firstObject,
      secondObject,
      keysComposition,
      key,
      firstKey: keyExistsIn(key, firstObject) ? key : null,
      secondKey: keyExistsIn(key, secondObject) ? key : null,
    })
  })
  return composed
}

const applyCompositionForcingLowerCase = (
  firstObject,
  secondObject,
  { keysComposition, strict },
) => {
  if (strict) {
    const firstObjectKeyMapping = {}
    Object.keys(firstObject).forEach((key) => {
      firstObjectKeyMapping[key.toLowerCase()] = key
    })
    const secondObjectKeyMapping = {}
    Object.keys(secondObject).forEach((key) => {
      secondObjectKeyMapping[key.toLowerCase()] = key
    })
    Object.keys(keysComposition).forEach((key) => {
      composed[key] = composeValueAtKey({
        firstObject,
        secondObject,
        keysComposition,
        key,
        firstKey: firstObjectKeyMapping[key] || null,
        secondKey: secondObjectKeyMapping[key] || null,
      })
    })
  }

  const composed = {}
  Object.keys(firstObject).forEach((key) => {
    composed[key.toLowerCase()] = firstObject[key]
  })
  Object.keys(secondObject).forEach((key) => {
    const keyLowercased = key.toLowerCase()

    composed[key.toLowerCase()] = composeValueAtKey({
      firstObject,
      secondObject,
      keysComposition,
      key: keyLowercased,
      firstKey: keyExistsIn(keyLowercased, firstObject)
        ? keyLowercased
        : keyExistsIn(key, firstObject)
        ? key
        : null,
      secondKey: keyExistsIn(keyLowercased, secondObject)
        ? keyLowercased
        : keyExistsIn(key, secondObject)
        ? key
        : null,
    })
  })
  return composed
}

const composeValueAtKey = ({
  firstObject,
  secondObject,
  firstKey,
  secondKey,
  key,
  keysComposition,
}) => {
  if (!firstKey) {
    return secondObject[secondKey]
  }

  if (!secondKey) {
    return firstObject[firstKey]
  }

  const keyForCustomComposition = keyExistsIn(key, keysComposition) ? key : null
  if (!keyForCustomComposition) {
    return secondObject[secondKey]
  }

  const composeTwoValues = keysComposition[keyForCustomComposition]
  return composeTwoValues(firstObject[firstKey], secondObject[secondKey])
}

const keyExistsIn = (key, object) => {
  return Object.prototype.hasOwnProperty.call(object, key)
}
