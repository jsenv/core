import { PATTERN } from "./pattern.js";

export const createHeadersPattern = (headers) => {
  const headerPatternMap = new Map();
  const headerNames = Object.keys(headers);
  for (const headerName of headerNames) {
    const headerValue = headers[headerName];
    const headerValuePattern = PATTERN.create(headerValue);
    headerPatternMap.set(headerName, headerValuePattern);
  }
  return {
    match: (headersToMatch) => {
      const namedValues = {};
      for (const [headerName, headerValuePattern] of headerPatternMap) {
        const headerValue = headersToMatch[headerName];
        const matchResult = headerValuePattern.match(headerValue);
        if (!matchResult) {
          return false;
        }
        const named = matchResult.named;
        Object.assign(namedValues, named);
      }
      return namedValues;
    },
    generate: (headers, values) => {
      const headersGenerated = {};
      for (const headerName of Object.keys(headers)) {
        const headerValue = headers[headerName];
        const pattern = headerPatternMap.get(headerName);
        if (pattern) {
          headersGenerated[headerName] = pattern.generate(headerValue, values);
        } else {
          headersGenerated[headerName] = headerValue;
        }
      }
      return headersGenerated;
    },
  };
};
