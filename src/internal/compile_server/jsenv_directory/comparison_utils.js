export const sameValueInTwoObjects = (object, secondObject) => {
  const objectKeys = Object.keys(object)
  const secondObjectKeys = Object.keys(secondObject)
  if (!sameValuesInTwoArrays(objectKeys, secondObjectKeys)) {
    return false
  }
  return objectKeys.every((key) => {
    const objectKeyValue = object[key]
    const secondObjectKeyValue = secondObject[key]
    if (
      typeof objectKeyValue === "object" &&
      objectKeyValue !== null &&
      typeof secondObjectKeyValue === "object" &&
      secondObjectKeyValue !== null
    ) {
      return sameValueInTwoObjects(objectKeyValue, secondObjectKeyValue)
    }
    return objectKeyValue === secondObjectKeyValue
  })
}

export const sameValuesInTwoArrays = (array, secondArray) => {
  return (
    array.length === secondArray.length &&
    array.every((value) => secondArray.includes(value))
  )
}
