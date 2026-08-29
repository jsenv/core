import { parseMultipleHeader } from "../internal/multiple_header.js";
import { pickAcceptedContent } from "./pick_accepted_content.js";

/**
 * Pick, among the media types the server can produce, the one the request
 * prefers according to its `accept` header (quality values honored, `text/*`
 * style wildcards understood).
 *
 * @param {{ headers: Object }} request - Anything carrying lowercased `headers`.
 * @param {Array<string>} availableContentTypes - In order of server preference: on a tie the first one wins.
 * @returns {string|null} The media type to respond with, `null` when the request
 *   accepts none of them or has no `accept` header.
 */
export const pickContentType = (request, availableContentTypes) => {
  const { headers = {} } = request;
  const requestAcceptHeader = headers.accept;
  if (!requestAcceptHeader) {
    return null;
  }

  const contentTypesAccepted = parseAcceptHeader(requestAcceptHeader);
  return pickAcceptedContent({
    accepteds: contentTypesAccepted,
    availables: availableContentTypes,
    getAcceptanceScore: getContentTypeAcceptanceScore,
  });
};

const parseAcceptHeader = (acceptHeader) => {
  const acceptHeaderObject = parseMultipleHeader(acceptHeader, {
    validateProperty: ({ name }) => {
      // read only q, anything else is ignored
      return name === "q";
    },
  });

  const accepts = [];
  Object.keys(acceptHeaderObject).forEach((key) => {
    const { q = 1 } = acceptHeaderObject[key];
    const value = key;
    accepts.push({
      value,
      quality: q,
    });
  });
  accepts.sort((a, b) => {
    return b.quality - a.quality;
  });
  return accepts;
};

const getContentTypeAcceptanceScore = (
  { value, quality },
  availableContentType,
) => {
  const [acceptedType, acceptedSubtype] = decomposeContentType(value);
  const [availableType, availableSubtype] =
    decomposeContentType(availableContentType);

  const typeAccepted = acceptedType === "*" || acceptedType === availableType;
  const subtypeAccepted =
    acceptedSubtype === "*" || acceptedSubtype === availableSubtype;

  if (typeAccepted && subtypeAccepted) {
    return quality;
  }
  return -1;
};

const decomposeContentType = (fullType) => {
  const [type, subtype] = fullType.split("/");
  return [type, subtype];
};
