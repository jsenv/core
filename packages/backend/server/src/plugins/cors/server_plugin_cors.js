/**
 * @jsenv/server is already registering a route to handle OPTIONS request
 * so here we just need to add the CORS headers to the response
 */

export const jsenvAccessControlAllowedHeaders = ["x-requested-with"];

export const jsenvAccessControlAllowedMethods = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "OPTIONS",
];

/**
 * Server plugin adding the CORS response headers to every response, including
 * errors (a browser treats a 500 without them as a CORS failure). Disabled
 * (returns no plugin) unless `accessControlAllowRequestOrigin` is true or
 * `accessControlAllowedOrigins` is non empty.
 *
 * @param {Object} [params]
 * @param {Array<string>} [params.accessControlAllowedOrigins=[]] - Origins allowed to
 *   read responses. `*` stands for any run of characters except "/":
 *   `"https://pr-*-my-app.fly.dev"` matches every preview deployment.
 * @param {Array<string>} [params.accessControlAllowedMethods] - Defaults to
 *   GET, POST, PUT, DELETE, OPTIONS.
 * @param {Array<string>} [params.accessControlAllowedHeaders] - Defaults to `["x-requested-with"]`.
 * @param {boolean} [params.accessControlAllowRequestOrigin=false] - Reflect any request
 *   origin, whatever `accessControlAllowedOrigins` says.
 * @param {boolean} [params.accessControlAllowRequestMethod=false] - Also allow the method a
 *   preflight asks for (`access-control-request-method`).
 * @param {boolean} [params.accessControlAllowRequestHeaders=false] - Also allow the headers a
 *   preflight asks for (`access-control-request-headers`).
 * @param {boolean} [params.accessControlAllowCredentials=false] - Send
 *   `access-control-allow-credentials: true`.
 * @param {number} [params.accessControlMaxAge=600] - Seconds a browser may cache the preflight.
 * @param {boolean} [params.timingAllowOrigin=false] - Send `timing-allow-origin` so the
 *   allowed origin can read resource timing.
 * @returns {Object|Array} The plugin, or `[]` when CORS stays disabled.
 */
export const serverPluginCORS = ({
  accessControlAllowedOrigins = [],
  accessControlAllowedMethods = jsenvAccessControlAllowedMethods,
  accessControlAllowedHeaders = jsenvAccessControlAllowedHeaders,
  accessControlAllowRequestOrigin = false,
  accessControlAllowRequestMethod = false,
  accessControlAllowRequestHeaders = false,
  accessControlAllowCredentials = false,
  // by default OPTIONS request can be cache for a long time, it's not going to change soon ?
  // we could put a lot here, see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Max-Age
  accessControlMaxAge = 600,
  timingAllowOrigin = false,
} = {}) => {
  // TODO: we should check access control params and throw/warn if we find strange values

  const corsEnabled =
    accessControlAllowRequestOrigin || accessControlAllowedOrigins.length;

  if (!corsEnabled) {
    return [];
  }

  const allowedOriginChecker = createAllowedOriginChecker(
    accessControlAllowedOrigins,
  );

  return {
    name: "jsenv:cors",
    injectResponseProperties: (request) => {
      const accessControlHeaders = generateAccessControlHeaders({
        request,
        allowedOriginChecker,
        accessControlAllowRequestOrigin,
        accessControlAllowedMethods,
        accessControlAllowRequestMethod,
        accessControlAllowedHeaders,
        accessControlAllowRequestHeaders,
        accessControlAllowCredentials,
        accessControlMaxAge,
        timingAllowOrigin,
      });
      return {
        headers: accessControlHeaders,
      };
    },
  };
};

/**
 * An origin ("scheme://host:port") can never contain "*", so it is free to be
 * used as a wildcard standing for any run of characters except "/":
 * "https://pr-*-my-app.fly.dev" matches "https://pr-12-my-app.fly.dev".
 */
const createAllowedOriginChecker = (allowedOrigins) => {
  const literalOrigins = [];
  const originRegExps = [];
  for (const allowedOrigin of allowedOrigins) {
    if (allowedOrigin.includes("*")) {
      originRegExps.push(originPatternToRegExp(allowedOrigin));
    } else {
      literalOrigins.push(allowedOrigin);
    }
  }

  return {
    // when the request origin cannot be reflected back we must still send a
    // single valid origin, never a pattern
    defaultOrigin: literalOrigins[0] ?? "*",
    isAllowed: (origin) => {
      if (literalOrigins.includes(origin)) {
        return true;
      }
      for (const originRegExp of originRegExps) {
        if (originRegExp.test(origin)) {
          return true;
        }
      }
      return false;
    },
  };
};

const originPatternToRegExp = (originPattern) => {
  const source = originPattern
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("[^/]*");
  return new RegExp(`^${source}$`);
};

// https://www.w3.org/TR/cors/
// https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
const generateAccessControlHeaders = ({
  request: { headers },
  allowedOriginChecker,
  accessControlAllowRequestOrigin,
  accessControlAllowedMethods,
  accessControlAllowRequestMethod,
  accessControlAllowedHeaders,
  accessControlAllowRequestHeaders,
  accessControlAllowCredentials,
  // by default OPTIONS request can be cache for a long time, it's not going to change soon ?
  // we could put a lot here, see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Max-Age
  accessControlMaxAge = 600,
  timingAllowOrigin,
} = {}) => {
  const vary = [];

  // Access-Control-Allow-Origin must be a single value (not a list).
  // We reflect back the request's origin if it is in the allowed list.
  // If no origin matches we fall back to "*" (only when not using credentials).
  let allowOrigin = null;

  const requestOrigin = readRequestOrigin(headers);

  if (requestOrigin) {
    if (allowedOriginChecker.isAllowed(requestOrigin)) {
      allowOrigin = requestOrigin;
      vary.push("origin");
    } else if (accessControlAllowRequestOrigin) {
      allowOrigin = requestOrigin;
      vary.push("origin");
    }
  } else if (accessControlAllowRequestOrigin) {
    allowOrigin = "*";
  }

  if (allowOrigin === null) {
    allowOrigin = allowedOriginChecker.defaultOrigin;
  }

  const allowedMethodArray = [...accessControlAllowedMethods];
  if (
    accessControlAllowRequestMethod &&
    "access-control-request-method" in headers
  ) {
    const requestMethodName = headers["access-control-request-method"];
    if (!allowedMethodArray.includes(requestMethodName)) {
      allowedMethodArray.push(requestMethodName);
      vary.push("access-control-request-method");
    }
  }

  const allowedHeaderArray = [...accessControlAllowedHeaders];
  if (
    accessControlAllowRequestHeaders &&
    "access-control-request-headers" in headers
  ) {
    const requestHeaderNameArray =
      headers["access-control-request-headers"].split(", ");
    requestHeaderNameArray.forEach((headerName) => {
      const headerNameLowerCase = headerName.toLowerCase();
      if (!allowedHeaderArray.includes(headerNameLowerCase)) {
        allowedHeaderArray.push(headerNameLowerCase);
        if (!vary.includes("access-control-request-headers")) {
          vary.push("access-control-request-headers");
        }
      }
    });
  }

  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-methods": allowedMethodArray.join(", "),
    "access-control-allow-headers": allowedHeaderArray.join(", "),
    ...(accessControlAllowCredentials
      ? { "access-control-allow-credentials": true }
      : {}),
    "access-control-max-age": accessControlMaxAge,
    ...(timingAllowOrigin ? { "timing-allow-origin": allowOrigin } : {}),
    ...(vary.length ? { vary: vary.join(", ") } : {}),
  };
};

// the referer is a fallback for clients not sending "origin"; it comes from
// the network and may not be a url at all
const readRequestOrigin = (headers) => {
  if ("origin" in headers && headers.origin !== "null") {
    return headers.origin;
  }
  if ("referer" in headers && URL.canParse(headers.referer)) {
    return new URL(headers.referer).origin;
  }
  return null;
};
