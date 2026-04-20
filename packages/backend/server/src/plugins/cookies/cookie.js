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
    let str = `${name}=${value}`;
    if (options.expires) {
      str += `; Expires=${options.expires.toUTCString()}`;
    }
    if (options.maxAge !== undefined) {
      str += `; Max-Age=${options.maxAge}`;
    }
    if (options.path) {
      str += `; Path=${options.path}`;
    }
    if (options.domain) {
      str += `; Domain=${options.domain}`;
    }
    if (options.sameSite) {
      str += `; SameSite=${options.sameSite}`;
    }
    if (options.secure) {
      str += "; Secure";
    }
    if (options.httpOnly) {
      str += "; HttpOnly";
    }
    return str;
  },
  toSetCookieHeaders: (cookies) => {
    const headers = {};
    for (const cookie of cookies) {
      const value = COOKIE.stringify(cookie);
      if (headers["set-cookie"] === undefined) {
        headers["set-cookie"] = value;
      } else if (Array.isArray(headers["set-cookie"])) {
        headers["set-cookie"].push(value);
      } else {
        headers["set-cookie"] = [headers["set-cookie"], value];
      }
    }
    return headers;
  },
};
