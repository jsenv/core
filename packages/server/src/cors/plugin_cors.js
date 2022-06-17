export const jsenvAccessControlAllowedHeaders = ["x-requested-with"]

export const jsenvAccessControlAllowedMethods = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "OPTIONS",
]

export const pluginCORS = ({
  accessControlAllowedOrigins = [],
  accessControlAllowedMethods = jsenvAccessControlAllowedMethods,
  accessControlAllowedHeaders = jsenvAccessControlAllowedHeaders,
  accessControlAllowRequestOrigin = false,
  accessControlAllowRequestMethod = false,
  accessControlAllowRequestHeaders = false,
  accessControlAllowCredentials = false,
  // by default OPTIONS request can be cache for a long time, it's not going to change soon ?
  // we could put a lot here, see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Max-Age
  accessControlMaxAge = 600,
  timingAllowOrigin,
} = {}) => {
  // TODO: we should check access control params to throw or warn if we find strange values

  const corsEnabled =
    accessControlAllowRequestOrigin || accessControlAllowedOrigins.length

  if (!corsEnabled) {
    return {
      cors: {},
    }
  }

  return {
    cors: {
      onServerParams: ({ plugins }) => {
        if (timingAllowOrigin === undefined && plugins.server_timings) {
          timingAllowOrigin = true
        }
      },

      onRequest: (request, { shortcircuitResponse }) => {
        if (request.method === "OPTIONS") {
          // when request method is "OPTIONS" we must return a 200 without body
          // So we bypass "requestToResponse" in that scenario using shortcircuitResponse
          shortcircuitResponse({
            status: 200,
            headers: {
              "content-length": 0,
            },
          })
        }

        if (request.parent) {
          return null
        }

        return {
          onResponse: () => {
            const accessControlHeaders = generateAccessControlHeaders({
              request,
              accessControlAllowedOrigins,
              accessControlAllowRequestOrigin,
              accessControlAllowedMethods,
              accessControlAllowRequestMethod,
              accessControlAllowedHeaders,
              accessControlAllowRequestHeaders,
              accessControlAllowCredentials,
              accessControlMaxAge,
              timingAllowOrigin,
            })

            return {
              headers: accessControlHeaders,
            }
          },
        }
      },
    },
  }
}

// https://www.w3.org/TR/cors/
// https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
const generateAccessControlHeaders = ({
  request: { headers },
  accessControlAllowedOrigins,
  accessControlAllowRequestOrigin,
  accessControlAllowedMethods,
  accessControlAllowRequestMethod,
  accessControlAllowedHeaders,
  accessControlAllowRequestHeaders,
  accessControlAllowCredentials,
  // by default OPTIONS request can be cache for a long time, it's not going to change soon ?
  // we could put a lot here, see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Max-Age
  accessControlMaxAge = 600,
  timingAllowOrigin,
} = {}) => {
  const vary = []

  const allowedOriginArray = [...accessControlAllowedOrigins]
  if (accessControlAllowRequestOrigin) {
    if ("origin" in headers && headers.origin !== "null") {
      allowedOriginArray.push(headers.origin)
      vary.push("origin")
    } else if ("referer" in headers) {
      allowedOriginArray.push(new URL(headers.referer).origin)
      vary.push("referer")
    } else {
      allowedOriginArray.push("*")
    }
  }

  const allowedMethodArray = [...accessControlAllowedMethods]
  if (
    accessControlAllowRequestMethod &&
    "access-control-request-method" in headers
  ) {
    const requestMethodName = headers["access-control-request-method"]
    if (!allowedMethodArray.includes(requestMethodName)) {
      allowedMethodArray.push(requestMethodName)
      vary.push("access-control-request-method")
    }
  }

  const allowedHeaderArray = [...accessControlAllowedHeaders]
  if (
    accessControlAllowRequestHeaders &&
    "access-control-request-headers" in headers
  ) {
    const requestHeaderNameArray =
      headers["access-control-request-headers"].split(", ")
    requestHeaderNameArray.forEach((headerName) => {
      const headerNameLowerCase = headerName.toLowerCase()
      if (!allowedHeaderArray.includes(headerNameLowerCase)) {
        allowedHeaderArray.push(headerNameLowerCase)
        if (!vary.includes("access-control-request-headers")) {
          vary.push("access-control-request-headers")
        }
      }
    })
  }

  return {
    "access-control-allow-origin": allowedOriginArray.join(", "),
    "access-control-allow-methods": allowedMethodArray.join(", "),
    "access-control-allow-headers": allowedHeaderArray.join(", "),
    ...(accessControlAllowCredentials
      ? { "access-control-allow-credentials": true }
      : {}),
    "access-control-max-age": accessControlMaxAge,
    ...(timingAllowOrigin
      ? { "timing-allow-origin": allowedOriginArray.join(", ") }
      : {}),
    ...(vary.length ? { vary: vary.join(", ") } : {}),
  }
}
