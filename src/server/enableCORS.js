import { responseCompose } from "./responseCompose.js"

// https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
export const enableCORS = (
  response,
  {
    allowedOrigins = ["*"],
    allowedMethods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders = ["x-requested-with", "content-type", "accept"],
  } = {},
) => {
  const corsHeaders = {
    "access-control-allow-origin": allowedOrigins.join(", "),
    "access-control-allow-methods": allowedMethods.join(", "),
    "access-control-allow-headers": allowedHeaders.join(", "),
    "access-control-allow-credentials": true,
    // by default OPTIONS request can be cache for a long time, it's not going to change soon ?
    // we could put a lot here, see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Max-Age
    "access-control-max-age": 1,
    vary: "Origin",
  }

  return responseCompose({ headers: corsHeaders }, response)
}
