import { createRouter } from "./router.js";

export const jsenvServiceRouting = (routes) => {
  const router = createRouter();
  for (const route of routes) {
    router.add(route);
  }

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
