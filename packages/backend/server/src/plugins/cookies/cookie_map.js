import { COOKIE } from "./cookie.js";

export const createCookieMap = (setCookieString) => {
  const map = new Map();

  if (setCookieString) {
    const cookies = setCookieString.split(", ");
    for (const cookie of cookies) {
      const parsedCookie = COOKIE.parse(cookie);
      map.set(parsedCookie.name, parsedCookie);
    }
  }

  return {
    map,
    toSetCookieHeaders: () => {},
  };
};
