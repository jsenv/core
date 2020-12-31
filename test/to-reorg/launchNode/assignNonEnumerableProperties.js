export const assignNonEnumerableProperties = (object, properties) => {
  Object.keys(properties).forEach((name) => {
    Object.defineProperty(object, name, {
      value: properties[name],
    })
  })
  return object
}
