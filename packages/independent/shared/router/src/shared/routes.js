import { parseResourcePattern } from "./resource_pattern.js";

export const createRoutes = (description, create = createRoute) => {
  const routeArray = [];
  for (const key of Object.keys(description)) {
    const handler = description[key];
    if (key === "*") {
      const route = create({
        methodPattern: "*",
        resourcePattern: "*",
        handler,
      });
      routeArray.push(route);
    } else {
      const [methodPattern, resourcePattern] = key.split(" ");
      const route = create({
        methodPattern,
        resourcePattern,
        handler,
      });
      routeArray.push(route);
    }
  }
  // routeArray.sort((left, right) => {
  //   const leftIsAnyMethod = left.method === "*";
  //   const rightIsAnyMethod = right.method === "*";
  //   if (leftIsAnyMethod && !rightIsAnyMethod) {
  //     return 1;
  //   }
  //   if (rightIsAnyMethod && !leftIsAnyMethod) {
  //     return -1;
  //   }
  //   const leftIsAnyResource = left.resource === "*";
  //   const rightIsAnyResource = right.resource === "*";
  //   if (leftIsAnyResource && !rightIsAnyResource) {
  //     return 1;
  //   }
  //   if (rightIsAnyResource && !leftIsAnyResource) {
  //     return -1;
  //   }
  //   const leftResourceLength = left.resource.length;
  //   const rightResourceLength = right.resource.length;
  //   if (leftResourceLength > rightResourceLength) {
  //     return -1;
  //   }
  //   if (rightResourceLength > leftResourceLength) {
  //     return 1;
  //   }
  //   return 0;
  // });
  return routeArray;
};

const createRoute = ({ methodPattern, resourcePattern, handler }) => {
  const resourcePatternParsed = parseResourcePattern(resourcePattern);
  const route = {
    methodPattern,
    resourcePattern,
    match: ({ method, resource }) => {
      if (route.methodPattern !== method && route.methodPattern !== "*") {
        return false;
      }
      const matchResult = resourcePatternParsed.match(resource);
      if (!matchResult) {
        return false;
      }
      return matchResult;
    },
    build: (url, params) => {
      return resourcePatternParsed.build(url, params);
    },
    handler,
  };

  return route;
};
