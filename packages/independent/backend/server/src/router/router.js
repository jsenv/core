import { parseFunction } from "@jsenv/assert/src/utils/function_parser.js";
import { createHeadersPattern } from "@jsenv/router/src/shared/headers_pattern.js";
import { PATTERN } from "@jsenv/router/src/shared/pattern.js";
import { createResourcePattern } from "@jsenv/router/src/shared/resource_pattern.js";
import { resourceToExtension } from "@jsenv/urls";
import { readFileSync } from "node:fs";
import { pickContentEncoding } from "../content_negotiation/pick_content_encoding.js";
import { pickContentLanguage } from "../content_negotiation/pick_content_language.js";
import { pickContentType } from "../content_negotiation/pick_content_type.js";
import { pickContentVersion } from "../content_negotiation/pick_content_version.js";
import { replacePlaceholdersInHtml } from "../replace_placeholder_in_html.js";

const clientErrorHtmlTemplateFileUrl = import.meta.resolve("./client/4xx.html");
const routeInspectorUrl = `/.internal/route_inspector`;

const HTTP_METHODS = [
  "OPTIONS",
  "HEAD",
  "GET",
  "POST",
  "PATCH",
  "PUT",
  "DELETE",
];

/**
 * Adds a route to the router.
 *
 * @param {Object} params - Route configuration object
 * @param {string} params.endpoint - String in format "METHOD /resource/path" (e.g. "GET /users/:id")
 * @param {Object} [params.headers] - Optional headers pattern to match
 * @param {Array<string>} [params.availableMediaTypes=[]] - Content types this route can produce
 * @param {Array<string>} [params.availableLanguages=[]] - Languages this route can respond with
 * @param {Array<string>} [params.availableEncodings=[]] - Encodings this route supports
 * @param {Array<string>} [params.acceptedMediaTypes=[]] - Content types this route accepts (for POST/PATCH/PUT)
 * @param {Function} params.fetch - Function to generate response for matching requests
 * @throws {TypeError} If endpoint is not a string
 * @returns {void}
 */
export const createRoute = ({
  endpoint,
  description,
  headers,
  service,
  availableMediaTypes = [],
  availableLanguages = [],
  availableVersions = [],
  availableEncodings = [],
  acceptedMediaTypes = [], // useful only for POST/PATCH/PUT
  fetch: routeFetchMethod, // rename because there is global.fetch and we want to be explicit
  clientCodeExample,
  isFallback,
  subroutes,
}) => {
  if (!endpoint || typeof endpoint !== "string") {
    throw new TypeError(`endpoint must be a string, received ${endpoint}`);
  }
  const [method, resource] = endpoint === "*" ? ["* *"] : endpoint.split(" ");
  if (method !== "*" && !HTTP_METHODS.includes(method)) {
    throw new TypeError(`"${method}" is not an HTTP method`);
  }
  if (resource[0] !== "/" && resource[0] !== "*") {
    throw new TypeError(`resource must start with /, received ${resource}`);
  }
  if (typeof routeFetchMethod !== "function") {
    throw new TypeError(
      `fetch must be a function, received ${routeFetchMethod}`,
    );
  }
  const resourcePattern = createResourcePattern(resource);
  const headersPattern = headers ? createHeadersPattern(headers) : null;

  const isForWebSocket =
    (headers && headers["upgrade"] === "websocket") ||
    resourceToExtension(resource) === ".websocket";

  const route = {
    method,
    resource,
    description,
    service,
    availableMediaTypes,
    availableLanguages,
    availableVersions,
    availableEncodings,
    acceptedMediaTypes,
    matchMethod:
      method === "*" ? () => true : (requestMethod) => requestMethod === method,
    matchResource:
      resource === "*"
        ? () => true
        : (requestResource) => {
            return resourcePattern.match(requestResource);
          },
    matchHeaders:
      headers === undefined
        ? () => true
        : (requestHeaders) => {
            return headersPattern.match(requestHeaders);
          },
    fetch: routeFetchMethod,
    toString: () => {
      return `${method} ${resource}`;
    },
    toJSON: () => {
      return {
        method,
        resource,
        description,
        availableMediaTypes,
        availableLanguages,
        availableVersions,
        availableEncodings,
        acceptedMediaTypes,
        isForWebSocket,
        clientCodeExample:
          typeof clientCodeExample === "function"
            ? parseFunction(clientCodeExample).body
            : typeof clientCodeExample === "string"
              ? clientCodeExample
              : undefined,
      };
    },
    resourcePattern,
    isForWebSocket,
    isFallback,
    subroutes,
  };
  return route;
};

export const createRouter = (
  routeDescriptionArray,
  { optionsFallback } = {},
) => {
  const routeSet = new Set();

  const constructAvailableEndpoints = () => {
    // TODO: memoize
    // TODO: construct only if the route is visible to that client
    const availableEndpoints = [];
    const createEndpoint = ({ method, resource }) => {
      return {
        method,
        resource,
        toString: () => {
          return `${method} ${resource}`;
        },
      };
    };

    for (const route of routeSet) {
      const endpointResource = route.resourcePattern.generateExample();
      if (route.method === "*") {
        for (const HTTP_METHOD of HTTP_METHODS) {
          availableEndpoints.push(
            createEndpoint({
              method: HTTP_METHOD,
              resource: endpointResource,
            }),
          );
        }
      } else {
        availableEndpoints.push(
          createEndpoint({
            method: route.method,
            resource: endpointResource,
          }),
        );
      }
    }
    return availableEndpoints;
  };
  const createResourceOptions = () => {
    const acceptedMediaTypeSet = new Set();
    const postAcceptedMediaTypeSet = new Set();
    const patchAcceptedMediaTypeSet = new Set();
    const allowedMethodSet = new Set();
    return {
      onMethodAllowed: (route, method) => {
        allowedMethodSet.add(method);
        for (const acceptedMediaType of route.acceptedMediaTypes) {
          acceptedMediaTypeSet.add(acceptedMediaType);
          if (method === "POST") {
            postAcceptedMediaTypeSet.add(acceptedMediaType);
          }
          if (method === "PATCH") {
            patchAcceptedMediaTypeSet.add(acceptedMediaType);
          }
        }
      },
      asResponseHeaders: () => {
        const headers = {};
        if (acceptedMediaTypeSet.size) {
          headers["accept"] = Array.from(acceptedMediaTypeSet).join(", ");
        }
        if (postAcceptedMediaTypeSet.size) {
          headers["accept-post"] = Array.from(postAcceptedMediaTypeSet).join(
            ", ",
          );
        }
        if (patchAcceptedMediaTypeSet.size) {
          headers["accept-patch"] = Array.from(patchAcceptedMediaTypeSet).join(
            ", ",
          );
        }
        if (allowedMethodSet.size) {
          headers["allow"] = Array.from(allowedMethodSet).join(", ");
        }
        return headers;
      },
      toJSON: () => {
        return {
          acceptedMediaTypes: Array.from(acceptedMediaTypeSet),
          postAcceptedMediaTypes: Array.from(postAcceptedMediaTypeSet),
          patchAcceptedMediaTypes: Array.from(patchAcceptedMediaTypeSet),
          allowedMethods: Array.from(allowedMethodSet),
        };
      },
    };
  };
  const forEachMethodAllowed = (route, onMethodAllowed) => {
    const supportedMethods =
      route.method === "*" ? HTTP_METHODS : [route.method];
    for (const supportedMethod of supportedMethods) {
      onMethodAllowed(supportedMethod);
    }
  };
  const inferResourceOPTIONS = (request) => {
    const resourceOptions = createResourceOptions();
    for (const route of routeSet) {
      if (!route.matchResource(request.resource)) {
        continue;
      }
      const accessControlRequestMethodHeader =
        request.headers["access-control-request-method"];
      if (accessControlRequestMethodHeader) {
        if (route.matchMethod(accessControlRequestMethodHeader)) {
          resourceOptions.onMethodAllowed(
            route,
            accessControlRequestMethodHeader,
          );
        }
      } else {
        forEachMethodAllowed(route, (methodAllowed) => {
          resourceOptions.onMethodAllowed(route, methodAllowed);
        });
      }
    }
    return resourceOptions;
  };
  const inferServerOPTIONS = () => {
    const serverOptions = createResourceOptions();
    const resourceOptionsMap = new Map();

    for (const route of routeSet) {
      const routeResource = route.resource;
      let resourceOptions = resourceOptionsMap.get(routeResource);
      if (!resourceOptions) {
        resourceOptions = createResourceOptions();
        resourceOptionsMap.set(routeResource, resourceOptions);
      }
      forEachMethodAllowed(route, (method) => {
        serverOptions.onMethodAllowed(route, method);
        resourceOptions.onMethodAllowed(route, method);
      });
    }
    return {
      server: serverOptions,
      resourceOptionsMap,
    };
  };

  const router = {};
  for (const routeDescription of routeDescriptionArray) {
    const route = createRoute(routeDescription);
    if (route.subroutes) {
      const subroutes = route.subroutes();
      for (const subroute of subroutes) {
        routeSet.add(subroute);
      }
    }
    routeSet.add(route);
  }

  const match = async (
    request,
    { pushResponse, injectResponseHeader, timing } = {},
  ) => {
    const wouldHaveMatched = {
      // in case nothing matches we can produce a response with Allow: GET, POST, PUT for example
      methodSet: new Set(),
      requestMediaTypeSet: new Set(),
      responseMediaTypeSet: new Set(),
      responseLanguageSet: new Set(),
      responseVersionSet: new Set(),
      responseEncodingSet: new Set(),
      upgrade: false,
    };

    let currentService;
    let currentRoutingTiming;
    const onRouteMatchStart = (route) => {
      if (route.service === currentService) {
        return;
      }
      onRouteGroupEnd(route);
      currentRoutingTiming = timing(
        route.service
          ? `${route.service.name.replace("jsenv:", "")}.routing`
          : "routing",
      );
      currentService = route.service;
    };
    const onRouteGroupEnd = () => {
      if (currentRoutingTiming) {
        currentRoutingTiming.end();
      }
    };
    const onRouteMatch = (route) => {
      onRouteGroupEnd(route);
    };

    const helpers = { timing, pushResponse, contentNegotiation: null };
    for (const route of routeSet) {
      onRouteMatchStart(route);
      const resourceMatchResult = route.matchResource(request.resource);
      if (!resourceMatchResult) {
        continue;
      }
      if (request.headers["upgrade"] === "websocket" && !route.isForWebSocket) {
        continue;
      }
      if (!route.matchMethod(request.method)) {
        if (!route.isFallback) {
          wouldHaveMatched.methodSet.add(route.method);
        }
        continue;
      }
      if (
        request.method === "POST" ||
        request.method === "PATCH" ||
        request.method === "PUT"
      ) {
        const { acceptedMediaTypes } = route;
        if (
          acceptedMediaTypes.length &&
          !isRequestBodyMediaTypeSupported(request, { acceptedMediaTypes })
        ) {
          for (const acceptedMediaType of acceptedMediaTypes) {
            wouldHaveMatched.requestMediaTypeSet.add(acceptedMediaType);
          }
          continue;
        }
      }
      const headersMatchResult = route.matchHeaders(request.headers);
      if (!headersMatchResult) {
        continue;
      }
      if (route.isForWebSocket && request.headers["upgrade"] !== "websocket") {
        wouldHaveMatched.upgrade = true;
        continue;
      }
      // now we are "good", let's try to generate a response
      const contentNegotiationResult = {};
      content_negotiation: {
        // when content nego fails
        // we will check the remaining accept headers to properly inform client of all the things are failing
        // Example:
        // client says "I want text in french"
        // but server only provide json in english
        // we want to tell client both text and french are not available
        let hasFailed = false;
        const { availableMediaTypes } = route;
        if (availableMediaTypes.length) {
          if (request.headers["accept"]) {
            const mediaTypeNegotiated = pickContentType(
              request,
              availableMediaTypes,
            );
            if (!mediaTypeNegotiated) {
              for (const availableMediaType of availableMediaTypes) {
                wouldHaveMatched.responseMediaTypeSet.add(availableMediaType);
              }
              hasFailed = true;
            }
            contentNegotiationResult.mediaType = mediaTypeNegotiated;
          } else {
            contentNegotiationResult.mediaType = availableMediaTypes[0];
          }
        }
        const { availableLanguages } = route;
        if (availableLanguages.length) {
          if (request.headers["accept-language"]) {
            const languageNegotiated = pickContentLanguage(
              request,
              availableLanguages,
            );
            if (!languageNegotiated) {
              for (const availableLanguage of availableLanguages) {
                wouldHaveMatched.responseLanguageSet.add(availableLanguage);
              }
              hasFailed = true;
            }
            contentNegotiationResult.language = languageNegotiated;
          } else {
            contentNegotiationResult.language = availableLanguages[0];
          }
        }
        const { availableVersions } = route;
        if (availableVersions.length) {
          if (request.headers["accept-version"]) {
            const versionNegotiated = pickContentVersion(
              request,
              availableVersions,
            );
            if (!versionNegotiated) {
              for (const availableVersion of availableVersions) {
                wouldHaveMatched.responseVersionSet.add(availableVersion);
              }
              hasFailed = true;
            }
            contentNegotiationResult.version = versionNegotiated;
          } else {
            contentNegotiationResult.version = availableVersions[0];
          }
        }
        const { availableEncodings } = route;
        if (availableEncodings.length) {
          if (request.headers["accept-encoding"]) {
            const encodingNegotiated = pickContentEncoding(
              request,
              availableEncodings,
            );
            if (!encodingNegotiated) {
              for (const availableEncoding of availableEncodings) {
                wouldHaveMatched.responseEncodingSet.add(availableEncoding);
              }
              hasFailed = true;
            }
            contentNegotiationResult.encoding = encodingNegotiated;
          } else {
            contentNegotiationResult.encoding = availableEncodings[0];
          }
        }
        if (hasFailed) {
          continue;
        }
      }
      const { named, stars = [] } = PATTERN.composeTwoMatchResults(
        resourceMatchResult,
        headersMatchResult,
      );
      Object.assign(request.params, named, stars);
      helpers.contentNegotiation = contentNegotiationResult;
      let fetchReturnValue = route.fetch(request, helpers);
      if (
        fetchReturnValue !== null &&
        typeof fetchReturnValue === "object" &&
        typeof fetchReturnValue.then === "function"
      ) {
        fetchReturnValue = await fetchReturnValue;
      }
      // route decided not to handle in the end
      if (fetchReturnValue === null || fetchReturnValue === undefined) {
        continue;
      }
      if (contentNegotiationResult.mediaType) {
        injectResponseHeader("vary", "accept");
      }
      if (contentNegotiationResult.language) {
        injectResponseHeader("vary", "accept-language");
      }
      if (contentNegotiationResult.version) {
        injectResponseHeader("vary", "accept-version");
      }
      if (contentNegotiationResult.encoding) {
        injectResponseHeader("vary", "accept-encoding");
      }

      onRouteMatch(route);
      // TODO: check response headers to warn if headers[content-version] is missing
      // when a route set availableVersions for example
      // same for language, content type, etc
      return fetchReturnValue;
    }
    // nothing has matched fully
    // if nothing matches at all we'll send 404
    // but if url matched but METHOD was not supported we send 405
    if (wouldHaveMatched.methodSet.size) {
      return createMethodNotAllowedResponse(request, {
        allowedMethods: [...wouldHaveMatched.methodSet],
      });
    }
    if (wouldHaveMatched.requestMediaTypeSet.size) {
      return createUnsupportedMediaTypeResponse(request, {
        acceptedMediaTypes: [...wouldHaveMatched.requestMediaTypeSet],
      });
    }
    if (
      wouldHaveMatched.responseMediaTypeSet.size ||
      wouldHaveMatched.responseLanguageSet.size ||
      wouldHaveMatched.responseEncodingSet.size
    ) {
      return createNotAcceptableResponse(request, {
        availableMediaTypes: [...wouldHaveMatched.responseMediaTypeSet],
        availableLanguages: [...wouldHaveMatched.responseLanguageSet],
        availableVersions: [...wouldHaveMatched.responseVersionSet],
        availableEncodings: [...wouldHaveMatched.responseEncodingSet],
      });
    }
    if (wouldHaveMatched.upgrade) {
      return createClientErrorResponse(request, {
        status: 426,
        statusText: "Upgrade Required",
        message: {
          text: `The request requires the upgrade to a webSocket connection`,
          html: `The request requires the upgrade to a webSocket connection`,
        },
      });
    }
    const availableEndpoints = constructAvailableEndpoints(request, { timing });
    return createRouteNotFoundResponse(request, { availableEndpoints });
  };
  const inspect = () => {
    // I want all the info I can gather about the routes
    const data = [];
    for (const route of routeSet) {
      data.push(route.toJSON());
    }
    return data;
  };

  if (optionsFallback) {
    const optionRouteFallback = createRoute({
      endpoint: "OPTIONS *",
      description:
        "Auto generate an OPTIONS response about a resource or the whole server.",
      fetch: (request, helpers) => {
        const isForAnyRoute = request.resource === "*";
        if (isForAnyRoute) {
          const serverOPTIONS = inferServerOPTIONS(request, helpers);
          return createServerResourceOptionsResponse(request, serverOPTIONS);
        }
        const resourceOPTIONS = inferResourceOPTIONS(request, helpers);
        return createResourceOptionsResponse(request, resourceOPTIONS);
      },
      isFallback: true,
    });
    routeSet.add(optionRouteFallback);
  }

  Object.assign(router, {
    match,
    inspect,
  });
  return router;
};

const isRequestBodyMediaTypeSupported = (request, { acceptedMediaTypes }) => {
  const requestBodyContentType = request.headers["content-type"];
  if (!requestBodyContentType) {
    return false;
  }
  for (const acceptedMediaType of acceptedMediaTypes) {
    if (requestBodyContentType.includes(acceptedMediaType)) {
      return true;
    }
  }
  return false;
};

const createServerResourceOptionsResponse = (
  request,
  { server, resourceOptionsMap },
) => {
  const headers = server.asResponseHeaders();
  const mediaTypeNegotiated = pickContentType(request, [
    "application/json",
    "text/plain",
  ]);
  if (mediaTypeNegotiated === "application/json") {
    const perResource = {};
    for (const [resource, resourceOptions] of resourceOptionsMap) {
      perResource[resource] = resourceOptions.toJSON();
    }
    return Response.json(
      {
        server: server.toJSON(),
        perResource,
      },
      { status: 200, headers },
    );
  }
  // text/plain
  return new Response(
    `The list of endpoints available can be seen at ${routeInspectorUrl}`,
    { status: 200, headers },
  );
};
const createResourceOptionsResponse = (request, resourceOptions) => {
  const headers = resourceOptions.asResponseHeaders();
  return new Response(undefined, { status: 204, headers });
};

/**
 * Creates a 406 Not Acceptable response when content negotiation fails
 *
 * @param {Object} request - The HTTP request object
 * @param {Object} params - Content negotiation parameters
 * @param {Array<string>} params.availableMediaTypes - Content types the server can produce
 * @param {Array<string>} params.availableLanguages - Languages the server can respond with
 * @param {Array<string>} params.availableEncodings - Encodings the server supports
 * @returns {Response} A 406 Not Acceptable response
 */
const createNotAcceptableResponse = (
  request,
  {
    availableMediaTypes,
    availableLanguages,
    availableVersions,
    availableEncodings,
  },
) => {
  const unsupported = [];
  const headers = {};
  const data = {};

  if (availableMediaTypes.length) {
    const requestAcceptHeader = request.headers["accept"];

    // Use a non-standard but semantic header name
    headers["available-media-types"] = availableMediaTypes.join(", ");

    Object.assign(data, {
      requestAcceptHeader,
      availableMediaTypes,
    });

    unsupported.push({
      type: "content-type",
      message: {
        text: `The server cannot produce a response in any of the media types accepted by the request: "${requestAcceptHeader}".
Available media types: ${availableMediaTypes.join(", ")}`,
        html: `The server cannot produce a response in any of the media types accepted by the request: <strong>${requestAcceptHeader}</strong>.<br />
Available content types: <strong>${availableMediaTypes.join(", ")}</strong>`,
      },
    });
  }
  if (availableLanguages.length) {
    const requestAcceptLanguageHeader = request.headers["accept-language"];

    // Use a non-standard but semantic header name
    headers["available-languages"] = availableLanguages.join(", ");

    Object.assign(data, {
      requestAcceptLanguageHeader,
      availableLanguages,
    });

    unsupported.push({
      type: "language",
      message: {
        text: `The server cannot produce a response in any of the languages accepted by the request: "${requestAcceptLanguageHeader}".
Available languages: ${availableLanguages.join(", ")}`,
        html: `The server cannot produce a response in any of the languages accepted by the request: <strong>${requestAcceptLanguageHeader}</strong>.<br />
Available languages: <strong>${availableLanguages.join(", ")}</strong>`,
      },
    });
  }
  if (availableVersions.length) {
    const requestAcceptVersionHeader = request.headers["accept-version"];

    // Use a non-standard but semantic header name
    headers["available-versions"] = availableVersions.join(", ");

    Object.assign(data, {
      requestAcceptVersionHeader,
      availableLanguages,
    });

    unsupported.push({
      type: "version",
      message: {
        text: `The server cannot produce a response in any of the versions accepted by the request: "${requestAcceptVersionHeader}".
Available versions: ${availableVersions.join(", ")}`,
        html: `The server cannot produce a response in any of the versions accepted by the request: <strong>${requestAcceptVersionHeader}</strong>.<br />
Available versions: <strong>${availableVersions.join(", ")}</strong>`,
      },
    });
  }
  if (availableEncodings.length) {
    const requestAcceptEncodingHeader = request.headers["accept-encoding"];

    // Use a non-standard but semantic header name
    headers["available-encodings"] = availableEncodings.join(", ");

    Object.assign(data, {
      requestAcceptEncodingHeader,
      availableEncodings,
    });

    unsupported.push({
      type: "encoding",
      message: {
        text: `The server cannot encode the response in any of the encodings accepted by the request: "${requestAcceptEncodingHeader}".
Available encodings: ${availableEncodings.join(", ")}`,
        html: `The server cannot encode the response in any of the encodings accepted by the request: <strong>${requestAcceptEncodingHeader}</strong>.<br />
Available encodings: <strong>${availableEncodings.join(", ")}</strong>`,
      },
    });
  }

  // Special case for single negotiation failure
  if (unsupported.length === 1) {
    const [{ message }] = unsupported;
    return createClientErrorResponse(request, {
      status: 406,
      statusText: "Not Acceptable",
      headers,
      message,
      data,
    });
  }
  // Handle multiple negotiation failures
  let message = {
    text: `The server cannot produce a response in a format acceptable to the client:`,
    html: `The server cannot produce a response in a format acceptable to the client:`,
  };
  message.html += "<ul>";
  for (const info of unsupported) {
    message.text += `\n- ${info.type} ${info.message.text}`;
    message.html += `<li>${info.type} ${info.message.html}</li>`;
  }
  message.html += "</ul>";

  return createClientErrorResponse(request, {
    status: 406,
    statusText: "Not Acceptable",
    headers,
    message,
    data,
  });
};
const createMethodNotAllowedResponse = (
  request,
  { allowedMethods = [] } = {},
) => {
  return createClientErrorResponse(request, {
    status: 405,
    statusText: "Method Not Allowed",
    headers: {
      allow: allowedMethods.join(", "),
    },
    message: {
      text: `The HTTP method "${request.method}" is not supported for this resource.
Allowed methods: ${allowedMethods.join(", ")}`,
      html: `The HTTP method <strong>${request.method}</strong> is not supported for this resource.<br />
Allowed methods: <strong>${allowedMethods.join(", ")}</strong>`,
    },
    data: {
      requestMethod: request.method,
      allowedMethods,
    },
  });
};
const createUnsupportedMediaTypeResponse = (
  request,
  { acceptedMediaTypes },
) => {
  const requestContentType = request.headers["content-type"];
  const methodSpecificHeader =
    request.method === "POST"
      ? "accept-post"
      : request.method === "PATCH"
        ? "accept-patch"
        : "accept";
  const headers = {
    [methodSpecificHeader]: acceptedMediaTypes.join(", "),
  };
  const requestMethod = request.method;

  return createClientErrorResponse(request, {
    status: 415,
    statusText: "Unsupported Media Type",
    headers,
    message: {
      text: requestContentType
        ? `The media type "${requestContentType}" specified in the Content-Type header is not supported for ${requestMethod} requests to this resource.
Supported media types: ${acceptedMediaTypes.join(", ")}`
        : `The Content-Type header is missing. It must be declared for ${requestMethod} requests to this resource.`,
      html: requestContentType
        ? `The content type <strong>${requestContentType}</strong> is not supported for ${requestMethod} requests to this resource.<br />
Supported media types: <strong>${acceptedMediaTypes.join(", ")}</strong>`
        : `The Content-Type header is missing. It must be declared for ${requestMethod} requests to this resource.`,
    },
    data: {
      requestMethod,
      requestContentType,
      acceptedMediaTypes,
    },
  });
};
const createRouteNotFoundResponse = (request) => {
  return createClientErrorResponse(request, {
    status: 404,
    statusText: "Not Found",
    message: {
      text: `The URL ${request.resource} does not exist on this server.
The list of existing endpoints is available at ${routeInspectorUrl}`,
      html: `The URL <strong>${request.resource}</strong> does not exists on this server.<br />
The list of existing endpoints is available at:
<a href="${routeInspectorUrl}">${routeInspectorUrl}</a>`,
    },
  });
};

const createClientErrorResponse = (
  request,
  { status, statusText, headers, message, data },
) => {
  const contentTypeNegotiated = pickContentType(request, [
    "application/json",
    "text/html",
    "text/plain",
  ]);
  if (contentTypeNegotiated === "text/html") {
    const htmlTemplate = readFileSync(
      new URL(clientErrorHtmlTemplateFileUrl),
      "utf8",
    );
    const html = replacePlaceholdersInHtml(htmlTemplate, {
      message: message.html,
      status,
      statusText,
      ...data,
    });
    return new Response(html, {
      status,
      statusText,
      headers: { ...headers, "content-type": "text/html" },
    });
  }
  if (contentTypeNegotiated === "application/json") {
    return Response.json(
      { message: message.text, data },
      { status, statusText, headers },
    );
  }
  return new Response(message.text, { status, statusText, headers });
};
