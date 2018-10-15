import { promiseMatch } from "../promiseHelper.js"

const serviceGeneratedResponsePredicate = (value) => typeof value === "object" && value !== null

export const createResponseGenerator = (...services) => {
  const generateResponse = (request) => {
    return promiseMatch(services, request, serviceGeneratedResponsePredicate).then(
      ({ status = 501, reason = "not specified", headers = {}, body = "" }) => {
        return Object.freeze({ status, reason, headers, body })
      },
    )
  }

  return generateResponse
}
