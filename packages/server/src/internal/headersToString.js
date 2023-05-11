export const headersToString = (headers, { convertName = (name) => name }) => {
  const headersString = headersToArray(headers).map(({ name, value }) => {
    return `${convertName(name)}: ${value}`;
  });

  return headersString.join("\r\n");
};

const headersToArray = (headers) => {
  return Object.keys(headers).map((name) => {
    return {
      name,
      value: headers[name],
    };
  });
};
