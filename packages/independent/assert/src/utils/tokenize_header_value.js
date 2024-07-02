/*
 * "cookies" example
 * name=test; Secure; SameSite=None;, b=b_value; Secure;
 * see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie
 * "accept-encoding" example
 * br;q=1.0, gzip;q=0.8, *;q=0.1
 * -> {br: {q: 1.0}, gzip: {q: 0.8}}
 */

// see also multiple-header.js

export const tokenizeSetCookieHeader = (headerValue) => {
  return parseHeaderAttributes(headerValue);
};
export const tokenizeAcceptEncodingHeader = (headerValue) => {
  return parseHeaderAttributes(headerValue, {
    q: (attributeValue) => {
      return isNaN(attributeValue)
        ? attributeValue
        : parseFloat(attributeValue);
    },
  });
};
// TODO: more headers here (server timings?)

const parseHeaderAttributes = (headerValue, attributeHandlers) => {
  const values = headerValue.split(",");
  const headerParseResult = {};
  for (const value of values) {
    const valueTrimmed = value.trim();
    const [nameValuePair, ...attributeSources] = valueTrimmed.split(";");
    const attributes = {};
    if (nameValuePair.includes("=")) {
      const [name, value] = nameValuePair.split("=");
      headerParseResult[name] = attributes;
      attributes.value = value;
    } else {
      headerParseResult[nameValuePair] = attributes;
      attributes.value = true;
    }
    for (const attributeSource of attributeSources) {
      const attributeSourceTrimmed = attributeSource.trim();
      if (attributeSourceTrimmed === "") {
        continue;
      }
      let [attributeName, attributeValue] = attributeSource.split("=");
      const attributeNameNormalized = attributeName.trim();
      const attributeHandler =
        attributeHandlers &&
        Object.hasOwn(attributeHandlers, attributeNameNormalized)
          ? attributeHandlers[attributeNameNormalized]
          : null;
      if (attributeHandler) {
        attributeHandler(attributeValue);
      }
      attributes[attributeName] = attributeValue;
    }
  }
  return headerParseResult;
};
