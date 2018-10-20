import { compileFileToService as defaultCompileFileToService } from "../../compileFileToService/index.js"

export const compileFileToService = (...args) => {
  const defaultService = defaultCompileFileToService(...args)
  return (request) => {
    return defaultService(request).catch((error) => {
      if (error && error.name === "PARSE_ERROR") {
        const json = JSON.stringify(error)

        return {
          status: 500,
          reason: "parse error",
          headers: {
            "cache-control": "no-store",
            "content-length": Buffer.byteLength(json),
            "content-type": "application/json",
          },
          body: json,
        }
      }
      return Promise.reject(error)
    })
  }
}
