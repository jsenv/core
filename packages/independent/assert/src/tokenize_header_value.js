// "accept-encoding": "br;q=1.0, gzip;q=0.8, *;q=0.1"
// I want to get: {br: {q: 1.0}, gzip: {q: 0.8}}

// see also multiple-header.js

export const tokenizeHeaderValue = (headerValue, headerName) => {
  if (headerName === "set-cookie") {
    return tokenizeCookieHeader(headerValue);
  }
  if (headerName === "accept-encoding") {
    return tokenizeAcceptHeader(headerValue);
  }
  return tokenizeOtherHeader(headerValue);
};

const tokenizeCookieHeader = (headerValue) => {
  const values = headerValue.split(",");
  const cookies = {};
  for (const value of values) {
    const valueTrimmed = value.trim();
    const [cookieNameValuePair, ...attributeSources] = valueTrimmed
      .split(";")
      .map((v) => v.trim());
    const [cookieName, cookieValue] = cookieNameValuePair.split("=");
    const attributes = {
      value: cookieValue,
    };
    for (const attributeSource of attributeSources.slice(1)) {
      let [attributeName, attributeValue] = attributeSource.split("=");
      attributes[attributeName] = attributeValue;
    }
    cookies[cookieName] = attributes;
  }
  return cookies;
};
const tokenizeAcceptHeader = (headerValue) => {
  const values = headerValue.split(",");
  const accepted = {};
  for (const value of values) {
    const valueTrimmed = value.trim();
    const [directiveName, ...attributeSources] = valueTrimmed.split(";");
    const attributes = {};
    for (const attributeSource of attributeSources.slice(1)) {
      let [attributeName, attributeValue] = attributeSource.split("=");
      if (attributeName === "q") {
        attributeValue = isNaN(attributeValue)
          ? attributeValue
          : parseFloat(attributeValue);
      }
      attributes[attributeName] = attributeValue;
    }
    accepted[directiveName] = attributes;
  }
  return accepted;
};
const tokenizeOtherHeader = (headerValue) => {
  const values = headerValue.split(",");
  return values.map((v) => v.trim());
};
