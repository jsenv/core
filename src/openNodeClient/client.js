import { ensureSystem } from "./ensureSystem.js"

const forceEnumerable = (value) => {
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

process.on("message", ({ type, id, data }) => {
  if (type === "execute") {
    const { remoteRoot, localRoot, file, setup, teardown } = data

    setup()
    ensureSystem({ remoteRoot, localRoot })
      .import(file)
      .then(teardown)
      .then(
        (value) => {
          process.send({
            id,
            type: "execute-result",
            data: {
              code: 0,
              value,
            },
          })
        },
        (reason) => {
          // process.send algorithm does not send non enumerable values
          // but for error.message, error.stack we would like to get them
          // se we force all object properties to be enumerable
          // we could use @dmail/uneval here instead, for now let's keep it simple
          process.send({
            id,
            type: "execute-result",
            data: {
              code: 1,
              value: forceEnumerable(reason),
            },
          })
        },
      )
  }
})
