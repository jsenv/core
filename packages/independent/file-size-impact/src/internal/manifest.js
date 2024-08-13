import { urlToRelativeUrl } from "@jsenv/urls";

export const manifestToMappings = (manifestMap) => {
  const mappings = {};
  Object.keys(manifestMap).forEach((manifestRelativeUrl) => {
    const manifest = manifestMap[manifestRelativeUrl];
    const manifestAbstractUrl = new URL(
      manifestRelativeUrl,
      ABSTRACT_DIRECTORY_URL,
    ).href;
    Object.keys(manifest).forEach((manifestKey) => {
      const manifestValue = manifest[manifestKey];
      const manifestKeyAsAbstractUrl = new URL(manifestKey, manifestAbstractUrl)
        .href;
      const manifestValueAsAbstractUrl = new URL(
        manifestValue,
        manifestAbstractUrl,
      ).href;
      const manifestKeyAsRelativeUrl = urlToRelativeUrl(
        manifestKeyAsAbstractUrl,
        ABSTRACT_DIRECTORY_URL,
      );
      const manifestValueAsRelativeUrl = urlToRelativeUrl(
        manifestValueAsAbstractUrl,
        ABSTRACT_DIRECTORY_URL,
      );
      mappings[manifestKeyAsRelativeUrl] = manifestValueAsRelativeUrl;
    });
  });
  return mappings;
};

const ABSTRACT_DIRECTORY_URL = "file:///directory/";

export const manifestKeyFromRelativeUrl = (relativeUrl, mappings) => {
  return Object.keys(mappings).find((keyCandidate) => {
    return mappings[keyCandidate] === relativeUrl;
  });
};
