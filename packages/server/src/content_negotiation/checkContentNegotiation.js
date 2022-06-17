import { negotiateContentType } from "./negotiateContentType.js"
import { negotiateContentLanguage } from "./negotiateContentLanguage.js"
import { negotiateContentEncoding } from "./negotiateContentEncoding.js"

export const checkContentNegotiation = (request, response, { warn }) => {
  const requestAcceptHeader = request.headers.accept
  const responseContentTypeHeader = response.headers["content-type"]
  if (
    requestAcceptHeader &&
    responseContentTypeHeader &&
    !negotiateContentType(request, [responseContentTypeHeader])
  ) {
    warn(`response content type is not in the request accepted content types.
--- response content-type header ---
${responseContentTypeHeader}
--- request accept header ---
${requestAcceptHeader}`)
  }

  const requestAcceptLanguageHeader = request.headers["accept-language"]
  const responseContentLanguageHeader = response.headers["content-language"]
  if (
    requestAcceptLanguageHeader &&
    responseContentLanguageHeader &&
    !negotiateContentLanguage(request, [responseContentLanguageHeader])
  ) {
    warn(`response language is not in the request accepted language.
--- response content-language header ---
${responseContentLanguageHeader}
--- request accept-language header ---
${requestAcceptLanguageHeader}`)
  }

  const requestAcceptEncodingHeader = request.headers["accept-encoding"]
  const responseContentEncodingHeader = response.headers["content-encoding"]
  if (
    requestAcceptLanguageHeader &&
    responseContentLanguageHeader &&
    !negotiateContentEncoding(request, [responseContentLanguageHeader])
  ) {
    warn(`response encoding is not in the request accepted encoding.
--- response content-encoding header ---
${responseContentEncodingHeader}
--- request accept-encoding header ---
${requestAcceptEncodingHeader}`)
  }
}
