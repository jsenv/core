// https://github.com/jsenv/core/blob/master/src/util/rest/helpers.js

export const createResponseGenerator = (...services) => {
  const generateResponse = (...args) => {
    return new Promise((resolve, reject) => {
      const visit = (index) => {
        if (index >= services.length) {
          resolve()
        } else {
          const service = services[index]
          Promise.resolve(service(...args)).then(
            (value) => {
              if (value) {
                resolve(value)
              } else {
                visit(index + 1)
              }
            },
            (value) => {
              if (value) {
                reject(value)
              } else {
                visit(index + 1)
              }
            },
          )
        }
      }

      visit(0)
    }).then(({ status = 501, reason = "not specified", headers = {}, body = "" }) => {
      return Object.freeze({ status, reason, headers, body })
    })
  }

  return generateResponse
}
