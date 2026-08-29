import { pickContentEncoding } from "../../content_negotiation/pick_content_encoding.js";
import { pickContentLanguage } from "../../content_negotiation/pick_content_language.js";
import { pickContentType } from "../../content_negotiation/pick_content_type.js";

/**
 * Server plugin logging a warning when a response does not honor what the
 * request accepts (`accept`, `accept-language`, `accept-encoding`). A
 * development aid: it changes nothing in the response.
 */
export const serverPluginResponseAcceptanceCheck = () => {
  return {
    name: "jsenv:response_acceptance_check",
    inspectResponse: (request, { response, warn }) => {
      checkResponseAcceptance(request, response, { warn });
    },
  };
};

const checkResponseAcceptance = (request, response, { warn }) => {
  const requestAcceptHeader = request.headers.accept;
  const responseContentTypeHeader = response.headers["content-type"];
  if (
    requestAcceptHeader &&
    responseContentTypeHeader &&
    !pickContentType(request, [responseContentTypeHeader])
  ) {
    warn(`response content type is not in the request accepted content types.
--- response content-type header ---
${responseContentTypeHeader}
--- request accept header ---
${requestAcceptHeader}`);
  }

  const requestAcceptLanguageHeader = request.headers["accept-language"];
  const responseContentLanguageHeader = response.headers["content-language"];
  if (
    requestAcceptLanguageHeader &&
    responseContentLanguageHeader &&
    !pickContentLanguage(request, [responseContentLanguageHeader])
  ) {
    warn(`response language is not in the request accepted language.
--- response content-language header ---
${responseContentLanguageHeader}
--- request accept-language header ---
${requestAcceptLanguageHeader}`);
  }

  const requestAcceptEncodingHeader = request.headers["accept-encoding"];
  const responseContentEncodingHeader = response.headers["content-encoding"];
  if (
    requestAcceptEncodingHeader &&
    responseContentEncodingHeader &&
    !pickContentEncoding(request, [responseContentEncodingHeader])
  ) {
    warn(`response encoding is not in the request accepted encoding.
--- response content-encoding header ---
${responseContentEncodingHeader}
--- request accept-encoding header ---
${requestAcceptEncodingHeader}`);
  }
};
