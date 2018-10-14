// https://github.com/jsenv/core/blob/master/src/util/rest/helpers.js

const serviceGeneratedResponsePredicate = (value) => typeof value === "object" && value !== null

export const createResponseGenerator = (...services) => {
  const generateResponse = (...args) => {
    return new Promise((resolve, reject) => {
      const visit = (index) => {
        if (index >= services.length) {
          return resolve()
        }
        const service = services[index]
        return Promise.resolve(service(...args)).then((value) => {
          if (serviceGeneratedResponsePredicate(value)) {
            return resolve(value)
          }
          return visit(index + 1)
        }, reject)
      }

      visit(0)
    }).then(({ status = 501, reason = "not specified", headers = {}, body = "" }) => {
      return Object.freeze({ status, reason, headers, body })
    })
  }

  return generateResponse
}
