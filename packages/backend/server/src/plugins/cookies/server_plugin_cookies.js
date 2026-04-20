import { COOKIE } from "./cookie.js";

export const serverPluginCookies = () => {
  return {
    name: "jsenv:cookies",
    augmentRouteFetchSecondArg: (request, fetchSecondArg) => {
      const requestCookieMap = parseRequestCookieHeader(
        request.headers["cookie"],
      );
      const responseCookieMap = new Map();

      const cookies = {
        get: (name) => {
          if (responseCookieMap.has(name)) {
            return responseCookieMap.get(name);
          }
          return requestCookieMap.get(name);
        },
        set: (name, value, options = {}) => {
          responseCookieMap.set(name, value);
          fetchSecondArg.injectResponseHeader(
            "set-cookie",
            COOKIE.stringify(COOKIE.from(name, value, options)),
          );
        },
        delete: (name, options = {}) => {
          responseCookieMap.delete(name);
          fetchSecondArg.injectResponseHeader(
            "set-cookie",
            COOKIE.stringify(
              COOKIE.from(name, "", {
                ...options,
                expires: new Date(0),
              }),
            ),
          );
        },
      };

      return { cookies };
    },
  };
};

const parseRequestCookieHeader = (cookieHeader) => {
  const map = new Map();
  if (!cookieHeader) {
    return map;
  }
  for (const pair of cookieHeader.split("; ")) {
    const eqIndex = pair.indexOf("=");
    if (eqIndex === -1) {
      continue;
    }
    const name = pair.slice(0, eqIndex).trim();
    const value = decodeURIComponent(pair.slice(eqIndex + 1));
    map.set(name, value);
  }
  return map;
};
