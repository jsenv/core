import { timeFunction } from "@jsenv/server/src/server_timing/timing_measure.js"
import { composeTwoResponses } from "@jsenv/server/src/internal/response_composition.js"
import { applyRedirectionToRequest } from "@jsenv/server/src/internal/request_factory.js"

export const composeServices = (namedServices) => {
  return async (request, { pushResponse }) => {
    const redirectRequest = (requestRedirection) => {
      request = applyRedirectionToRequest(request, requestRedirection)
    }

    const servicesTiming = {}
    const response = await firstOperationMatching({
      array: Object.keys(namedServices).map((serviceName) => {
        return { serviceName, serviceFn: namedServices[serviceName] }
      }),
      start: async ({ serviceName, serviceFn }) => {
        const [serviceTiming, value] = await timeFunction(serviceName, () =>
          serviceFn(request, { pushResponse, redirectRequest }),
        )
        Object.assign(servicesTiming, serviceTiming)
        return value
      },
      predicate: (returnValue) => {
        if (returnValue === null || typeof returnValue !== "object") {
          return false
        }
        return true
      },
    })
    if (response) {
      return composeTwoResponses({ timing: servicesTiming }, response)
    }
    return null
  }
}

const firstOperationMatching = ({ array, start, predicate }) => {
  return new Promise((resolve, reject) => {
    const visit = (index) => {
      if (index >= array.length) {
        return resolve()
      }
      const input = array[index]
      const returnValue = start(input)
      return Promise.resolve(returnValue).then((output) => {
        if (predicate(output)) {
          return resolve(output)
        }
        return visit(index + 1)
      }, reject)
    }

    visit(0)
  })
}
