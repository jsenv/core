import { createRoutes } from "../shared/routes.js";

export const routeClientRequest = (description) => {
  const routes = createRoutes(description);
  return (request) => {
    for (const route of routes) {
      const matchResult = route.match({
        method: request.method,
        resource: request.resource,
      });
      if (!matchResult) {
        continue;
      }
      return route.callback(request, matchResult);
    }
    return null;
  };
};
