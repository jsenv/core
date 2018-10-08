"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.headersToString = exports.headersFromString = exports.headersFromObject = void 0;

/*
https://developer.mozilla.org/en-US/docs/Web/API/Headers
https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
*/
const normalizeName = headerName => {
  headerName = String(headerName);

  if (/[^a-z0-9\-#$%&'*+.\^_`|~]/i.test(headerName)) {
    throw new TypeError("Invalid character in header field name");
  }

  return headerName.toLowerCase();
};

const normalizeValue = headerValue => {
  return String(headerValue);
};

const headersFromObject = headersObject => {
  const headers = {};
  Object.keys(headersObject).forEach(headerName => {
    headers[normalizeName(headerName)] = normalizeValue(headersObject[headerName]);
  });
  return headers;
}; // https://gist.github.com/mmazer/5404301


exports.headersFromObject = headersFromObject;

const headersFromString = headerString => {
  const headers = {};

  if (headerString) {
    const pairs = headerString.split("\r\n");
    pairs.forEach(pair => {
      const index = pair.indexOf(": ");

      if (index > 0) {
        const key = pair.slice(0, index);
        const value = pair.slice(index + 2);
        headers[normalizeName(key)] = normalizeValue(value);
      }
    });
  }

  return headers;
};

exports.headersFromString = headersFromString;

const headersToArray = headers => {
  return Object.keys(headers).map(name => {
    return {
      name,
      value: headers[name]
    };
  });
};

const headersToString = (headers, {
  convertName = name => name
}) => {
  const headersString = headersToArray(headers).map(({
    name,
    value
  }) => {
    return `${convertName(name)}: ${value}`;
  });
  return headersString.join("\r\n");
};

exports.headersToString = headersToString;
//# sourceMappingURL=headers.js.map