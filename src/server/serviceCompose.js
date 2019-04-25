import { firstOperationMatching } from "/node_modules/@dmail/helper/index.js"

const serviceGeneratedResponsePredicate = (value) => {
  if (value === null) {
    return false
  }
  return typeof value === "object"
}

export const firstService = (...callbacks) => {
  return firstOperationMatching({
    array: callbacks,
    start: (callback) => callback(),
    predicate: serviceGeneratedResponsePredicate,
  })
}

export const serviceCompose = (...callbacks) => {
  return (request) => {
    return firstOperationMatching({
      array: callbacks,
      start: (callback) => callback(request),
      predicate: serviceGeneratedResponsePredicate,
    })
  }
}
