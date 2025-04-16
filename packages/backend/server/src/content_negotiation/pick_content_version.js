import { parseMultipleHeader } from "../internal/multiple-header.js";
import { pickAcceptedContent } from "./pick_accepted_content.js";

export const pickContentVersion = (request, availableVersions) => {
  const { headers = {} } = request;
  const requestAcceptVersionHeader = headers["accept-version"];
  if (!requestAcceptVersionHeader) {
    return null;
  }

  const versionsAccepted = parseAcceptVersionHeader(requestAcceptVersionHeader);
  return pickAcceptedContent({
    accepteds: versionsAccepted,
    availables: availableVersions,
    getAcceptanceScore: getVersionAcceptanceScore,
  });
};

const parseAcceptVersionHeader = (acceptVersionHeaderString) => {
  const acceptVersionHeader = parseMultipleHeader(acceptVersionHeaderString, {
    validateProperty: ({ name }) => {
      // read only q, anything else is ignored
      return name === "q";
    },
  });

  const versionsAccepted = [];
  for (const key of Object.keys(acceptVersionHeader)) {
    const { q = 1 } = acceptVersionHeader[key];
    const value = key;
    versionsAccepted.push({
      value,
      quality: q,
    });
  }
  versionsAccepted.sort((a, b) => {
    return b.quality - a.quality;
  });
  return versionsAccepted;
};

const getVersionAcceptanceScore = ({ value, quality }, availableVersion) => {
  if (value === "*") {
    return quality;
  }

  if (typeof availableVersion === "function") {
    if (availableVersion(value)) {
      return quality;
    }
    return -1;
  }

  if (typeof availableVersion === "number") {
    availableVersion = String(availableVersion);
  }

  if (value === availableVersion) {
    return quality;
  }

  return -1;
};
