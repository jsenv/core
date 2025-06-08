export const COOKIE = {
  from: (name, value, options = {}) => {
    return { name, value, options };
  },
  parse: (cookieString) => {},
  stringify: ({ name, value, options }) => {},
};
