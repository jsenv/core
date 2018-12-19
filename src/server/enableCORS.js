import { arrayWithoutDuplicate } from "../arrayHelper.js"
import { hrefToOrigin } from "../urlHelper.js"
import { responseCompose } from "./responseCompose.js"

const requestHeadersToAllowedOrigin = (headers) => {
  if ("origin" in headers) return headers.origin
  if ("referer" in headers) return hrefToOrigin(headers.referer)
  return "*"
}

export const requestToAccessControlAllowedInfo = ({ headers }) => {
  const allowedOrigins = [requestHeadersToAllowedOrigin(headers)]
  const allowedMethods = arrayWithoutDuplicate([
    ...["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    ...("access-control-request-method" in headers ? headers["access-control-request-method"] : []),
  ])
  const allowedHeaders = arrayWithoutDuplicate([
    ...["x-requested-with", "content-type", "accept"],
    ...("access-control-request-headers" in headers
      ? headers["access-control-request-headers"].split(", ")
      : []),
  ])

  return {
    allowedOrigins,
    allowedMethods,
    allowedHeaders,
  }
}

// https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
export const enableCORS = (
  response,
  {
    allowedOrigins,
    allowedMethods,
    allowedHeaders,
    allowCredentials = true,
    // by default OPTIONS request can be cache for a long time, it's not going to change soon ?
    // we could put a lot here, see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Max-Age
    maxAge = 1,
    vary = ["Origin"],
  },
) => {
  const corsHeaders = {
    "access-control-allow-origin": allowedOrigins.join(", "),
    "access-control-allow-methods": allowedMethods.join(", "),
    "access-control-allow-headers": allowedHeaders.join(", "),
    "access-control-allow-credentials": allowCredentials,
    "access-control-max-age": maxAge,
    vary: vary.join(","),
  }

  return responseCompose({ headers: corsHeaders }, response)
}
