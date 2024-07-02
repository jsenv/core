import { validateResponseIntegrity } from "@jsenv/integrity";

export const assertFetchedContentCompliance = ({ urlInfo, content }) => {
  const { expectedContentType } = urlInfo.firstReference;
  if (expectedContentType && urlInfo.contentType !== expectedContentType) {
    throw new Error(
      `Unexpected content-type on url: "${expectedContentType}" was expect but got "${urlInfo.contentType}`,
    );
  }
  const { expectedType } = urlInfo.firstReference;
  if (expectedType && urlInfo.type !== expectedType) {
    throw new Error(
      `Unexpected type on url: "${expectedType}" was expect but got "${urlInfo.type}"`,
    );
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
