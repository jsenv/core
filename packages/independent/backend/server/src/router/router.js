import { createHeadersPattern } from "@jsenv/router/src/shared/headers_pattern.js";
import { PATTERN } from "@jsenv/router/src/shared/pattern.js";
import { createResourcePattern } from "@jsenv/router/src/shared/resource_pattern.js";
import { readFileSync } from "node:fs";
import { pickContentEncoding } from "../content_negotiation/pick_content_encoding.js";
import { pickContentLanguage } from "../content_negotiation/pick_content_language.js";
import { pickContentType } from "../content_negotiation/pick_content_type.js";
import { replacePlaceholdersInHtml } from "./replace_placeholder_in_html.js";

const clientErrorHtmlTemplateFileUrl = import.meta.resolve("./client/4xx.html");

const HTTP_METHODS = [
  "OPTIONS",
  "HEAD",
  "GET",
  "POST",
  "PATCH",
  "PUT",
  "DELETE",
];

export const createRouter = () => {
  const routeSet = new Set();

  const constructAvailableEndpoints = (request) => {
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
      const endpointResource = route.resourcePattern.generateExample(
        request.origin,
      );
      if (route.method === "*") {
        for (const HTTP_METHOD of HTTP_METHODS) {
          availableEndpoints.push(
            createEndpoint(HTTP_METHOD, endpointResource),
          );
        }
      } else {
        availableEndpoints.push(createEndpoint(route.method, endpointResource));
      }
    }
    return availableEndpoints;
  };

  const createResourceOptions = () => {
    const acceptedContentTypeSet = new Set();
    const postAcceptedContentTypeSet = new Set();
    const patchAcceptedContentTypeSet = new Set();
    const allowedMethodSet = new Set();
    return {
      onMethodAllowed: (route, method) => {
        allowedMethodSet.add(method);
        for (const acceptedContentType of route.acceptedContentTypes) {
          acceptedContentTypeSet.add(acceptedContentType);
          if (method === "POST") {
            postAcceptedContentTypeSet.add(acceptedContentType);
          }
          if (method === "PATCH") {
            patchAcceptedContentTypeSet.add(acceptedContentType);
          }
        }
      },
      asResponseHeaders: () => {
        const headers = {};
        if (acceptedContentTypeSet.size) {
          headers["accept"] = Array.from(acceptedContentTypeSet).join(", ");
        }
        if (postAcceptedContentTypeSet.size) {
          headers["accept-post"] = Array.from(postAcceptedContentTypeSet).join(
            ", ",
          );
        }
        if (patchAcceptedContentTypeSet.size) {
          headers["accept-patch"] = Array.from(
            patchAcceptedContentTypeSet,
          ).join(", ");
        }
        if (allowedMethodSet.size) {
          headers["allow"] = Array.from(allowedMethodSet).join(", ");
        }
        return headers;
      },
      toJSON: () => {
        return {
          acceptedContentTypes: Array.from(acceptedContentTypeSet),
          postAcceptedContentTypes: Array.from(postAcceptedContentTypeSet),
          patchAcceptedContentTypes: Array.from(patchAcceptedContentTypeSet),
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
      forEachMethodAllowed(route, (methodAllowed) => {
        resourceOptions.onMethodAllowed(route, methodAllowed);
      });
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

  const add = ({
    endpoint,
    headers,
    availableContentTypes = [],
    availableLanguages = [],
    availableEncodings = [],
    acceptedContentTypes = [], // useful only for POST/PATCH/PUT
    response,
  }) => {
    const [method, resource] = endpoint.split(" ");
    const resourcePattern = createResourcePattern(resource);
    const headersPattern = headers ? createHeadersPattern(headers) : null;

    const route = {
      method,
      resource,
      availableContentTypes,
      availableLanguages,
      availableEncodings,
      acceptedContentTypes,
      matchMethod:
        method === "*"
          ? () => true
          : (requestMethod) => requestMethod === method,
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
      response,
      toString: () => {
        return `${method} ${resource}`;
      },
      resourcePattern,
    };
    routeSet.add(route);
  };
  const match = async (request, { injectResponseHeader } = {}) => {
    const allowedMethods = [];
    for (const route of routeSet) {
      const resourceMatchResult = route.matchResource(request.resource);
      if (!resourceMatchResult) {
        continue;
      }
      if (!route.matchMethod(request.method)) {
        // we can already collect the fact resource has matched
        // in case nothing matches we can produce a response with Allow: GET, POST, PUT for example
        allowedMethods.push(route.method);
        continue;
      }
      const headersMatchResult = route.matchHeaders(request.headers);
      if (!headersMatchResult) {
        continue;
      }
      if (
        request.method === "POST" ||
        request.method === "PATCH" ||
        request.method === "PUT"
      ) {
        const { acceptedContentTypes } = route;
        if (
          acceptedContentTypes.length &&
          !isRequestBodyContentTypeSupported(request, { acceptedContentTypes })
        ) {
          return createUnsupportedMediaTypeResponse(request, {
            acceptedContentTypes,
          });
        }
      }

      // now we are "good", let's try to generate a response
      // now put negotiated stuff at the end
      const contentNegotiationResult = {};
      content_negotiation: {
        const { availableContentTypes } = route;
        if (availableContentTypes.length) {
          const contentTypeNegotiated = pickContentType(
            request,
            availableContentTypes,
          );
          contentNegotiationResult.contentType = contentTypeNegotiated;
        }
        const { availableLanguages } = route;
        if (availableLanguages.length) {
          const contentLanguageNegotiated = pickContentLanguage(
            request,
            availableContentTypes,
          );
          contentNegotiationResult.contentLanguage = contentLanguageNegotiated;
        }
        const { availableEncodings } = route;
        if (availableEncodings.length) {
          const contentEncodingNegotiated = pickContentEncoding(
            request,
            availableEncodings,
          );
          contentNegotiationResult.contentEncoding = contentEncodingNegotiated;
        }
      }
      const { named, stars = [] } = PATTERN.composeTwoMatchResults(
        resourceMatchResult,
        headersMatchResult,
      );
      let responseReturnValue = route.response(
        request,
        {
          ...named,
          contentNegotiation: contentNegotiationResult,
        },
        ...stars,
      );
      if (
        responseReturnValue !== null &&
        typeof responseReturnValue === "object" &&
        typeof responseReturnValue.then === "function"
      ) {
        responseReturnValue = await responseReturnValue;
      }
      // he decided not to handle in the end
      if (responseReturnValue === null || responseReturnValue === undefined) {
        continue;
      }
      if (contentNegotiationResult.contentType) {
        injectResponseHeader("vary", "accept");
      }
      if (contentNegotiationResult.contentLanguage) {
        injectResponseHeader("vary", "accept-language");
      }
      if (contentNegotiationResult.contentEncoding) {
        injectResponseHeader("vary", "accept-encoding");
      }
      return responseReturnValue;
    }
    if (request.method === "OPTIONS") {
      const isForAnyRoute = request.resource === "*";
      if (isForAnyRoute) {
        const serverOPTIONS = inferServerOPTIONS(request);
        return createServerResourceOptionsResponse(request, serverOPTIONS);
      }
      const resourceOPTIONS = inferResourceOPTIONS(request);
      return createResourceOptionsResponse(request, resourceOPTIONS);
    }
    // nothing has matched fully
    // if nothing matches at all we'll send 404
    // but if url matched but METHOD was not supported we send 405
    if (allowedMethods.length) {
      return createMethodNotAllowedResponse(request, { allowedMethods });
    }
    const availableEndpoints = constructAvailableEndpoints(request);
    return createRouteNotFoundResponse(request, { availableEndpoints });
  };
  return { add, match };
};

const isRequestBodyContentTypeSupported = (
  request,
  { acceptedContentTypes },
) => {
  const requestBodyContentType = request.headers["content-type"];
  if (!requestBodyContentType) {
    return false;
  }
  for (const acceptedContentType of acceptedContentTypes) {
    if (requestBodyContentType.includes(acceptedContentType)) {
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
  const contentTypeNegotiated = pickContentType(request, [
    "application/json",
    "text/plain",
  ]);
  if (contentTypeNegotiated === "application/json") {
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
  const endpointUIUrl = `${request.origin}/TODO`;
  return new Response(
    `The list of endpoints available can be seen at ${endpointUIUrl}`,
    { status: 200, headers },
  );
};
const createResourceOptionsResponse = (request, resourceOptions) => {
  const headers = resourceOptions.asResponseHeaders();
  return new Response(undefined, { status: 204, headers });
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
      text: `The HTTP method ${request.method} is not supported for this resource.
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
  { acceptedContentTypes },
) => {
  const requestMediaType = request.headers["content-type"];

  return createClientErrorResponse(request, {
    status: 415,
    statusText: "Unsupported Media Type",
    headers: {
      "supported-media": acceptedContentTypes.join(", "),
    },
    message: {
      text: requestMediaType
        ? `The media type "${requestMediaType}" is not supported for this resource.
Supported media types: ${acceptedContentTypes.join(", ")}`
        : `The media type was not specified in the request "content-type" header`,
      html: requestMediaType
        ? `The media type <strong>${requestMediaType}</strong> is not supported for this resource.<br />
Supported media types: <strong>${acceptedContentTypes.join(", ")}</strong>`
        : `The media type was not specified in the request "content-type" header`,
    },
    data: {
      requestMediaType,
      acceptedContentTypes,
    },
  });
};
const createRouteNotFoundResponse = (request, { availableEndpoints }) => {
  return createClientErrorResponse(request, {
    status: 404,
    statusText: "Not Found",
    message: {
      text: `The URL ${request.ressource} does not exists on this server.
The following urls are available: ${availableEndpoints.join("\n")}`,
      html: `The URL <strong>${request.ressource}</strong> does not exists on this server.<br />
The following urls are available:
<ul>
  ${availableEndpoints.map((availableEndpoint) => {
    return `
<li>
    <a href="${availableEndpoint.resource}">${availableEndpoint.method} ${availableEndpoint.resource}</a>
</li>
    `;
  })}
</ul>`,
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
      ...data,
    });
    return new Response(html, {
      status,
      statusText,
      headers: { ...headers, "content-type": "text/html" },
    });
  }
  if (contentTypeNegotiated === "application/json") {
    return Response.json({ data }, { status, statusText, headers });
  }
  return new Response(message.text, { status, statusText, headers });
};
