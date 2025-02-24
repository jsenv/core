import { parseResourcePattern } from "@jsenv/router/src/shared/resource_pattern.js";
import { readFileSync } from "node:fs";
import { pickContentType } from "../content_negotiation/pick_content_type.js";
import { replacePlaceholdersInHtml } from "./replace_placeholder_in_html.js";

const clientErrorHtmlTemplateFileUrl = import.meta.resolve("./client/4xx.html");

export const createRouter = () => {
  const routeSet = new Set();

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
    const resourcePatternParsed = parseResourcePattern(resource);

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
              return resourcePatternParsed.match(requestResource);
            },
      matchHeaders:
        headers === undefined
          ? () => true
          : (requestHeaders) => {
              // TODO
              return true;
            },
      response,
    };
    routeSet.add(route);
  };

  const match = async (request) => {
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
      if (!route.matchHeaders(request.headers)) {
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
      route.response(request);
    }

    if (allowedMethods.length) {
      return createMethodNotAllowedResponse(request, { allowedMethods });
    }
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
      html: `The HTTP method <strong>${request.method}</strong> is not supported for this resource.
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

  return createClientErrorResponse({
    status: 415,
    statusText: "Unsupported Media Type",
    headers: {
      "supported-media": acceptedContentTypes.join(", "),
    },
    message: {
      text: `The media type ${requestMediaType} is not supported for this resource.
Supported media types: ${acceptedContentTypes.join(", ")}`,
      html: `The media type <strong>${requestMediaType}</strong> is not supported for this resource.
Supported media types: <strong>${acceptedContentTypes.join(", ")}</strong>`,
    },
    data: {
      requestMediaType,
      acceptedContentTypes,
    },
  });
};

const createClientErrorResponse = (
  request,
  { status, statusText, headers, message, data },
) => {
  const contentTypeNegotiated = pickContentType(request, [
    "application/json",
    "text/plain",
    "text/html",
  ]);
  if (contentTypeNegotiated === "application/json") {
    return Response.json({ data }, { status, statusText, headers });
  }
  if (contentTypeNegotiated === "text/plain") {
    return new Response(message.text, { status, statusText, headers });
  }
  const htmlTemplate = readFileSync(clientErrorHtmlTemplateFileUrl, "utf8");
  const html = replacePlaceholdersInHtml(htmlTemplate, {
    message: message.html,
    ...data,
  });
  return new Response(html, {
    status,
    statusText,
    headers: { ...headers, "content-type": "text/html" },
  });
};
