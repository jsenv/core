export const createError = ({ message, ...rest }) => {
  const error = new Error(message)
  defineNonEnumerableProperties(error, rest)
  return error
}

const defineNonEnumerableProperties = (object, properties) => {
  Object.keys(properties).forEach((name) => {
    Object.defineProperty(object, name, {
      value: properties[name],
      enumerable: false,
    })
  })
}
