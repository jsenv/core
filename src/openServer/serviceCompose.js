import { promiseMatch } from "../promiseHelper.js"

const serviceGeneratedResponsePredicate = (value) => {
  if (value === null) {
    return false
  }
  return typeof value === "object"
}

export const serviceCompose = (...callbacks) => {
  return (request) => {
    return promiseMatch(callbacks, request, serviceGeneratedResponsePredicate)
  }
}
