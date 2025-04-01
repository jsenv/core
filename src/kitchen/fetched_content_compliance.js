import { validateResponseIntegrity } from "@jsenv/integrity";

export const assertFetchedContentCompliance = ({ urlInfo, content }) => {
  if (urlInfo.status === 404) {
    return;
  }
  const { expectedContentType } = urlInfo.firstReference;
  if (expectedContentType && urlInfo.contentType !== expectedContentType) {
    throw new Error(
      `content-type must be "${expectedContentType}", got "${urlInfo.contentType} on ${urlInfo.url}`,
    );
  }
  const { expectedType } = urlInfo.firstReference;
  if (expectedType && urlInfo.type !== expectedType) {
    if (urlInfo.type === "entry_build" && urlInfo.context.build) {
      // entry_build is a valid type during build
    } else {
      throw new Error(
        `type must be "${expectedType}", got "${urlInfo.type}" on ${urlInfo.url}`,
      );
    }
  }
  const { integrity } = urlInfo.firstReference;
  if (integrity) {
    validateResponseIntegrity({
      url: urlInfo.url,
      type: "basic",
      dataRepresentation: content,
    });
  }
};
