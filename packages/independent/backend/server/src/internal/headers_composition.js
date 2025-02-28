import { composeTwoObjects } from "./object_composition.js";

export const composeTwoHeaders = (firstHeaders, secondHeaders) => {
  return composeTwoObjects(firstHeaders, secondHeaders, {
    keysComposition: HEADER_NAMES_COMPOSITION,
    forceLowerCase: true,
  });
};

const composeHeaderValues = (value, nextValue) => {
  const currentValues = value
    .split(", ")
    .map((part) => part.trim().toLowerCase());
  const nextValues = nextValue
    .split(", ")
    .map((part) => part.trim().toLowerCase());
  for (const nextValue of nextValues) {
    if (!currentValues.includes(nextValue)) {
      currentValues.push(nextValue);
    }
  }
  return currentValues.join(", ");
};

const HEADER_NAMES_COMPOSITION = {
  "accept": composeHeaderValues,
  "accept-charset": composeHeaderValues,
  "accept-language": composeHeaderValues,
  "access-control-allow-headers": composeHeaderValues,
  "access-control-allow-methods": composeHeaderValues,
  "access-control-allow-origin": composeHeaderValues,
  "accept-patch": composeHeaderValues,
  "accept-post": composeHeaderValues,
  "allow": composeHeaderValues,
  // https://www.w3.org/TR/server-timing/
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Server-Timing
  "server-timing": composeHeaderValues,
  // 'content-type', // https://github.com/ninenines/cowboy/issues/1230
  "vary": composeHeaderValues,
};
