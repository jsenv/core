import { PATTERN } from "./pattern.js";

export const createHeadersPattern = (headers) => {
  return PATTERN.createKeyValue(headers);
};
