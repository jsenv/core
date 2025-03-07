import { composeTwoHeaders } from "./headers_composition.js";
import { composeTwoObjects } from "./object_composition.js";

const asResponseProperties = (value) => {
  if (value && value instanceof Response) {
    return {
      status: value.status,
      statusText: value.statusText,
      headers: Object.fromEntries(value.headers),
      body: value.body,
      bodyEncoding: value.bodyEncoding,
    };
  }
  return value;
};

export const composeTwoResponses = (firstResponse, secondResponse) => {
  firstResponse = asResponseProperties(firstResponse);
  secondResponse = asResponseProperties(secondResponse);

  return composeTwoObjects(firstResponse, secondResponse, {
    keysComposition: RESPONSE_KEYS_COMPOSITION,
    strict: true,
  });
};

const RESPONSE_KEYS_COMPOSITION = {
  status: (prevStatus, status) => status,
  statusText: (prevStatusText, statusText) => statusText,
  statusMessage: (prevStatusMessage, statusMessage) => statusMessage,
  headers: composeTwoHeaders,
  body: (prevBody, body) => body,
  bodyEncoding: (prevEncoding, encoding) => encoding,
};
