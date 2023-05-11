import { validateResponseIntegrity } from "@jsenv/integrity";

export const assertFetchedContentCompliance = ({ reference, urlInfo }) => {
  const { expectedContentType } = reference;
  if (expectedContentType && urlInfo.contentType !== expectedContentType) {
    throw new Error(
      `Unexpected content-type on url: "${expectedContentType}" was expected but got "${urlInfo.contentType}`,
    );
  }
  const { expectedType } = reference;
  if (expectedType && urlInfo.type !== expectedType) {
    throw new Error(
      `Unexpected type on url: "${expectedType}" was expected but got "${urlInfo.type}"`,
    );
  }
  const { integrity } = reference;
  if (integrity) {
    validateResponseIntegrity({
      url: urlInfo.url,
      type: "basic",
      dataRepresentation: urlInfo.content,
    });
  }
};
