import { createRoutes } from "@jsenv/router/src/shared/routes.js";
import {
  createUnsupportedMediaTypeResponse,
  getRequestBody,
  pickRequestContentType,
} from "@jsenv/server/src/request_body_handling.js";

export const jsenvServiceRouting = (description) => {
  const routes = createRoutes(description);
  for (const route of routes) {
    if (
      typeof route.handler === "object" &&
      route.methodPattern !== "POST" &&
      route.methodPattern !== "PATCH" &&
      route.methodPattern !== "PUT"
    ) {
      throw new Error(
        "route handler can be an object only when method is POST|PATCH|PUT",
      );
    }
  }

  return {
    handleRequest: (request) => {
      for (const route of routes) {
        const matchResult = route.match({
          method: request.method,
          resource: request.resource,
        });
        if (!matchResult) {
          continue;
        }
        return getResponseFromRoute(route, request, matchResult);
      }
      return null;
    },
    injectResponseHeaders: (response, { request }) => {
      if (request.method !== "OPTIONS") {
        return null;
      }
      const METHODS = [
        "OPTIONS",
        "HEAD",
        "GET",
        "POST",
        "PATCH",
        "PUT",
        "DELETE",
      ];
      const acceptedContentTypeSet = new Set();
      const postAcceptedContentTypeSet = new Set();
      const patchAcceptedContentTypeSet = new Set();
      const allowedMethodSet = new Set();
      for (const route of routes) {
        for (const METHOD of METHODS) {
          const matchResult = route.match({
            method: METHOD,
            resource: request.resource,
          });
          if (matchResult) {
            allowedMethodSet.add(METHOD);
            if (typeof route.handler === "object") {
              for (const acceptedContentType of Object.keys(route.handler)) {
                acceptedContentTypeSet.add(acceptedContentType);
                if (METHOD === "POST") {
                  postAcceptedContentTypeSet.add(acceptedContentType);
                }
                if (METHOD === "PATCH") {
                  patchAcceptedContentTypeSet.add(acceptedContentType);
                }
              }
            }
          }
        }
      }
      return {
        "accept": Array.from(acceptedContentTypeSet).join(", "),
        "accept-post": Array.from(postAcceptedContentTypeSet).join(", "),
        "accept-patch": Array.from(patchAcceptedContentTypeSet).join(", "),
        "allow": Array.from(allowedMethodSet).join(", "),
      };
    },
  };
};

const getResponseFromRoute = async (route, request, matchResult) => {
  const handler = route.handler;
  if (typeof handler === "function") {
    const response = await handler(request, matchResult);
    return response;
  }
  if (typeof handler === "object") {
    const acceptedRequestContentTypeArray = Object.keys(handler);
    const acceptedContentType = pickRequestContentType(
      request,
      acceptedRequestContentTypeArray,
    );
    if (!acceptedContentType) {
      return createUnsupportedMediaTypeResponse(
        request,
        acceptedRequestContentTypeArray,
      );
    }
    request.body.read = async () => {
      const requestBody = await getRequestBody(request, acceptedContentType);
      return requestBody;
    };
    const response = await handler[acceptedContentType](request, matchResult);
    return response;
  }
  return null;
};
