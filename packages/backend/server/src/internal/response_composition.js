import { composeTwoHeaders } from "./headers_composition.js";
import { composeTwoObjects } from "./object_composition.js";

const asResponseProperties = (value) => {
  if (value && value instanceof Response) {
    return {
      status: value.status,
      statusText: value.statusText,
      headers: Object.fromEntries(value.headers),
      body: value.body,
    };
  }
  return value;
};

/**
 * Merge two responses into one. Each can be a `Response` instance or a plain
 * `{ status, statusText, statusMessage, headers, body, timing }` object.
 * The second response wins for status, statusText, statusMessage and body;
 * headers are composed (list headers such as `vary` or `allow` accumulate
 * their values, `set-cookie` becomes an array) and `timing` objects are merged.
 *
 * @param {Response|Object} firstResponse
 * @param {Response|Object} secondResponse
 * @returns {Object} Plain response properties.
 */
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
  // measures a response hands back, merged into the server-timing header when
  // the server has serverTiming enabled (see finalizeResponseProperties)
  timing: (prevTiming, timing) => ({ ...prevTiming, ...timing }),
};
