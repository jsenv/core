// duplicated from @jsenv/humanize to avoid the dependency
export const createDetailedMessage = (message, details = {}) => {
  let string = `${message}`;

  Object.keys(details).forEach((key) => {
    const value = details[key];
    string += `
  --- ${key} ---
  ${
    Array.isArray(value)
      ? value.join(`
  `)
      : value
  }`;
  });

  return string;
};
