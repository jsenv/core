export const createParseError = (message, props) => {
  const parseError = new Error(message);
  defineNonEnumerableProperties(parseError, {
    code: "PARSE_ERROR",
    ...props,
  });
  return parseError;
};

const defineNonEnumerableProperties = (error, properties) => {
  for (const key of Object.keys(properties)) {
    Object.defineProperty(error, key, {
      configurable: true,
      writable: true,
      value: properties[key],
    });
  }
};
