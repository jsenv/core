import { createRequire } from "node:module"

const require = createRequire(import.meta.url)

export const setupRoutes = (routes) => {
  const { match } = require("path-to-regexp")

  const candidates = Object.keys(routes).map((pathPattern) => {
    const applyPatternMatching = match(pathPattern, {
      decode: decodeURIComponent,
    })
    return {
      applyPatternMatching,
      requestHandler: routes[pathPattern],
    }
  })

  return (request, { pushResponse, redirectRequest }) => {
    let result
    const found = candidates.find((candidate) => {
      result = candidate.applyPatternMatching(request.pathname)
      return Boolean(result)
    })
    if (found) {
      return found.requestHandler(
        {
          ...request,
          routeParams: result.params,
        },
        { pushResponse, redirectRequest },
      )
    }
    return null
  }
}
