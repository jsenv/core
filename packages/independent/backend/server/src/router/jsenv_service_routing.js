import { createRouter } from "./router.js";

export const jsenvServiceRouting = (routes) => {
  const router = createRouter();
  for (const route of routes) {
    router.add(route);
  }

  return {
    name: "jsenv:routing",
    handleRequest: async (request) => {
      const response = await router.match(request, {
        injectResponseHeader: () => {
          // TODO: how to do this?
        },
      });
      return response;
    },
  };
};
