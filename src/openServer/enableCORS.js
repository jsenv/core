import { headersCompose } from "./headers.js"

// https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
export const enableCORS = (
  request,
  response,
  {
    allowedOrigins = [request.headers.origin],
    allowedMethods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders = ["x-requested-with", "content-type", "accept"],
  } = {},
) => {
  const corsHeaders = {
    "access-control-allow-origin": allowedOrigins.join(", "),
    "access-control-allow-methods": allowedMethods.join(", "),
    "access-control-allow-headers": allowedHeaders.join(", "),
    "access-control-allow-credentials": true,
    "access-control-max-age": 1, // Seconds
    vary: "Origin",
  }

  return {
    ...response,
    headers: headersCompose(corsHeaders, response.headers),
  }
}
