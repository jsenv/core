import { readFileSync } from "node:fs";
import { createRouter } from "./router.js";

const routeInspectorHtmlFileUrl = import.meta.resolve(
  "./client/route_inspector.html",
);

export const jsenvServiceRouting = (routes) => {
  const router = createRouter();
  for (const route of routes) {
    router.add(route);
  }
  router.add({
    endpoint: "GET __inspect__/routes",
    availableContentTypes: ["text/html"],
    response: () => {
      const routeInspectorHtml = readFileSync(
        new URL(routeInspectorHtmlFileUrl),
        "utf8",
      );
      return new Response(routeInspectorHtml, {
        headers: { "content-type": "html" },
      });
    },
  });
  router.add({
    endpoint: "GET __inspect__/routes",
    availableContentTypes: ["application/json"],
    response: () => {
      const routeJSON = router.inspect();
      return Response.json(routeJSON);
    },
  });
  const headersToInjectMap = new Map();

  return {
    name: "jsenv:routing",
    handleRequest: async (request) => {
      const response = await router.match(request, {
        injectResponseHeader: (name, value) => {
          const headers = headersToInjectMap.get(request);
          if (headers) {
            headers[name] = value;
          } else {
            headersToInjectMap.set(request, { [name]: value });
          }
        },
      });
      request.signal.addEventListener("abort", () => {
        headersToInjectMap.delete(request);
      });
      return response;
    },
    injectResponseHeaders: (response, { request }) => {
      const headers = headersToInjectMap.get(request);
      headersToInjectMap.delete(request);
      return headers;
    },
  };
};
