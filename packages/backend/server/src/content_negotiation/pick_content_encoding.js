import { parseMultipleHeader } from "../internal/multiple_header.js";
import { pickAcceptedContent } from "./pick_accepted_content.js";

/**
 * Pick, among the encodings the server can produce, the one the request
 * prefers according to its `accept-encoding` header (`br` and `brotli` are
 * synonyms).
 *
 * @param {{ headers: Object }} request - Anything carrying lowercased `headers`.
 * @param {Array<string>} availableEncodings - In order of server preference: on a tie the first one wins.
 * @returns {string|null} The encoding to respond with, `null` when the request
 *   accepts none of them or has no `accept-encoding` header.
 */
export const pickContentEncoding = (request, availableEncodings) => {
  const { headers = {} } = request;
  const requestAcceptEncodingHeader = headers["accept-encoding"];
  if (!requestAcceptEncodingHeader) {
    return null;
  }

  const encodingsAccepted = parseAcceptEncodingHeader(
    requestAcceptEncodingHeader,
  );
  return pickAcceptedContent({
    accepteds: encodingsAccepted,
    availables: availableEncodings,
    getAcceptanceScore: getEncodingAcceptanceScore,
  });
};

const parseAcceptEncodingHeader = (acceptEncodingHeaderString) => {
  const acceptEncodingHeader = parseMultipleHeader(acceptEncodingHeaderString, {
    validateProperty: ({ name }) => {
      // read only q, anything else is ignored
      return name === "q";
    },
  });

  const encodingsAccepted = [];
  Object.keys(acceptEncodingHeader).forEach((key) => {
    const { q = 1 } = acceptEncodingHeader[key];
    const value = key;
    encodingsAccepted.push({
      value,
      quality: q,
    });
  });
  encodingsAccepted.sort((a, b) => {
    return b.quality - a.quality;
  });
  return encodingsAccepted;
};

const getEncodingAcceptanceScore = ({ value, quality }, availableEncoding) => {
  if (value === "*") {
    return quality;
  }

  // normalize br to brotli
  if (value === "br") value = "brotli";
  if (availableEncoding === "br") availableEncoding = "brotli";

  if (value === availableEncoding) {
    return quality;
  }

  return -1;
};
