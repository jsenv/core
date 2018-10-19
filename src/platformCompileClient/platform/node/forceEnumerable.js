export const forceEnumerable = (value) => {
  if (value === undefined || value === null || typeof value !== "object") {
    return value
  }

  const enumerableValue = {}
  Object.getOwnPropertyNames(value).forEach((name) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, name)

    Object.defineProperty(enumerableValue, name, {
      ...descriptor,
      ...{ enumerable: true },
      ...(descriptor.hasOwnProperty("value") ? { value: forceEnumerable(descriptor.value) } : {}),
    })
  })

  return enumerableValue
}
