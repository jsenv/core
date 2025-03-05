import { composeTwoObjects } from "./object_composition.js";

export const composeTwoHeaders = (firstHeaders, secondHeaders) => {
  return composeTwoObjects(firstHeaders, secondHeaders, {
    keysComposition: HEADER_NAMES_COMPOSITION,
    forceLowerCase: true,
  });
};

export const composeTwoHeaderValues = (name, leftValue, rightValue) => {
  if (HEADER_NAMES_COMPOSITION[name]) {
    return HEADER_NAMES_COMPOSITION[name](leftValue, rightValue);
  }
  return rightValue;
};

const composeTwoCommaSeparatedValues = (value, nextValue) => {
  if (!value) {
    return nextValue;
  }
  if (!nextValue) {
    return value;
  }
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
  "accept": composeTwoCommaSeparatedValues,
  "accept-charset": composeTwoCommaSeparatedValues,
  "accept-language": composeTwoCommaSeparatedValues,
  "access-control-allow-headers": composeTwoCommaSeparatedValues,
  "access-control-allow-methods": composeTwoCommaSeparatedValues,
  "access-control-allow-origin": composeTwoCommaSeparatedValues,
  "accept-patch": composeTwoCommaSeparatedValues,
  "accept-post": composeTwoCommaSeparatedValues,
  "allow": composeTwoCommaSeparatedValues,
  // https://www.w3.org/TR/server-timing/
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Server-Timing
  "server-timing": composeTwoCommaSeparatedValues,
  // 'content-type', // https://github.com/ninenines/cowboy/issues/1230
  "vary": composeTwoCommaSeparatedValues,
};
