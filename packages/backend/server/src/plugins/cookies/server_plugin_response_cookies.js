import { COOKIE } from "./cookie.js";

export const serverPluginResponseCookies = () => {
  return {
    name: "jsenv:response_cookies",
    augmentRouteFetchSecondArg: (request, fetchSecondArg) => {
      const responseCookies = {
        set: (name, value, options = {}) => {
          fetchSecondArg.injectResponseHeader(
            "set-cookie",
            COOKIE.stringify(COOKIE.from(name, value, options)),
          );
        },
        delete: (name, options = {}) => {
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

      return { responseCookies };
    },
  };
};
