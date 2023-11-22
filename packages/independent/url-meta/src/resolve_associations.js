import { assertUrlLike } from "./assertions.js";

export const resolveAssociations = (associations, baseUrl) => {
  if (baseUrl && typeof baseUrl.href === "string") baseUrl = baseUrl.href;
  assertUrlLike(baseUrl, "baseUrl");
  const associationsResolved = {};
  Object.keys(associations).forEach((key) => {
    const value = associations[key];
    if (typeof value === "object" && value !== null) {
      const valueMapResolved = {};
      Object.keys(value).forEach((pattern) => {
        const valueAssociated = value[pattern];
        const patternResolved = normalizeUrlPattern(pattern, baseUrl);
        valueMapResolved[patternResolved] = valueAssociated;
      });
      associationsResolved[key] = valueMapResolved;
    } else {
      associationsResolved[key] = value;
    }
  });
  return associationsResolved;
};

const normalizeUrlPattern = (urlPattern, baseUrl) => {
  try {
    return String(new URL(urlPattern, baseUrl));
  } catch (e) {
    // it's not really an url, no need to perform url resolution nor encoding
    return urlPattern;
  }
};
