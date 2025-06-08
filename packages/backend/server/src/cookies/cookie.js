// https://bun.sh/docs/api/cookie

export const COOKIE = {
  from: (name, value, options = {}) => {
    return { name, value, options };
  },
  parse: (cookieString) => {
    const parts = cookieString.split("; ");
    const [nameValue, ...attributes] = parts;
    const [name, value] = nameValue.split("=");
    const options = {};
    for (const attr of attributes) {
      const [key, val] = attr.split("=");
      if (key === "expires") {
        options.expires = new Date(val);
        continue;
      }

      if (key === "path") {
        options.path = val;
        continue;
      }
      if (key === "domain") {
        options.domain = val;
        continue;
      }
      if (key === "secure") {
        options.secure = true;
        continue;
      }
      if (key === "httponly") {
        options.httpOnly = true;
        continue;
      }
    }

    return { name, value, options };
  },
  stringify: ({ name, value, options }) => {
    return `${name}=${value}${options.expires ? `; Expires=${options.expires.toUTCString()}` : ""}${options.path ? `; Path=${options.path}` : ""}${options.domain ? `; Domain=${options.domain}` : ""}${options.secure ? "; Secure" : ""}${options.httpOnly ? "; HttpOnly" : ""}`;
  },
};
