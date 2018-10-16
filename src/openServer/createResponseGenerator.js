import { serviceCompose } from "./serviceCompose.js"

export const createResponseGenerator = (...services) => {
  const service = serviceCompose(...services)

  return (request) => {
    return Promise.resolve()
      .then(() => service(request))
      .then(({ status = 501, reason = "not specified", headers = {}, body = "" }) => {
        return Object.freeze({ status, reason, headers, body })
      })
  }
}
