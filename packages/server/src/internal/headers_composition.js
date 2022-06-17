import { composeTwoObjects } from "./object_composition.js"

export const composeTwoHeaders = (firstHeaders, secondHeaders) => {
  return composeTwoObjects(firstHeaders, secondHeaders, {
    keysComposition: HEADER_NAMES_COMPOSITION,
    forceLowerCase: true,
  })
}

const composeHeaderValues = (value, nextValue) => {
  const headerValues = value.split(", ")
  nextValue.split(", ").forEach((value) => {
    if (!headerValues.includes(value)) {
      headerValues.push(value)
    }
  })
  return headerValues.join(", ")
}

const HEADER_NAMES_COMPOSITION = {
  "accept": composeHeaderValues,
  "accept-charset": composeHeaderValues,
  "accept-language": composeHeaderValues,
  "access-control-allow-headers": composeHeaderValues,
  "access-control-allow-methods": composeHeaderValues,
  "access-control-allow-origin": composeHeaderValues,
  // https://www.w3.org/TR/server-timing/
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Server-Timing
  "server-timing": composeHeaderValues,
  // 'content-type', // https://github.com/ninenines/cowboy/issues/1230
  "vary": composeHeaderValues,
}
