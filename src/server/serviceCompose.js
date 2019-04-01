import { firstOperationMatching } from "@dmail/helper"

const serviceGeneratedResponsePredicate = (value) => {
  if (value === null) {
    return false
  }
  return typeof value === "object"
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
