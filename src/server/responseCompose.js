import { compositionMappingToComposeStrict, compositionMappingToCompose } from "@dmail/helper"

const composeHeaderValues = (value, nextValue) => `${value}, ${nextValue}`

const headerCompositionMapping = {
  accept: composeHeaderValues,
  "accept-charset": composeHeaderValues,
  "accept-language": composeHeaderValues,
  "access-control-allow-headers": composeHeaderValues,
  "access-control-allow-methods": composeHeaderValues,
  "access-control-allow-origin": composeHeaderValues,
  // 'content-type', // https://github.com/ninenines/cowboy/issues/1230
  vary: composeHeaderValues,
}

const responseCompositionMapping = {
  status: (prevStatus, status) => status,
  statusText: (prevStatusText, statusText) => statusText,
  headers: compositionMappingToCompose(headerCompositionMapping),
  body: (prevBody, body) => body,
}

export const responseCompose = compositionMappingToComposeStrict(responseCompositionMapping)
