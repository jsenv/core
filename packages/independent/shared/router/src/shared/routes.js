import { parseResourcePattern } from "./resource_pattern.js";

export const createRoutes = (description) => {
  const createCandidate = ({ method, resource, callback }) => {
    const resourcePatternParsed = parseResourcePattern(resource);

    const route = {
      method,
      resource,
      match: ({ method, resource }) => {
        if (route.method !== method && route.method !== "*") {
          return false;
        }
        if (!resourcePatternParsed.match(resource)) {
          return false;
        }
        return true;
      },
      callback,
    };

    return route;
  };
  const candidateArray = [];
  for (const key of Object.keys(description)) {
    const callback = description[key];
    if (key === "*") {
      const candidate = createCandidate({
        method: "*",
        resource: "*",
        callback,
      });
      candidateArray.push(candidate);
    } else {
      const [method, resource] = key.split(" ");
      const candidate = createCandidate({ method, resource, callback });
      candidateArray.push(candidate);
    }
  }
  candidateArray.sort((left, right) => {
    const leftIsAnyMethod = left.method === "*";
    const rightIsAnyMethod = right.method === "*";
    if (leftIsAnyMethod && !rightIsAnyMethod) {
      return 1;
    }
    if (rightIsAnyMethod && !leftIsAnyMethod) {
      return -1;
    }
    const leftIsAnyResource = left.resource === "*";
    const rightIsAnyResource = right.resource === "*";
    if (leftIsAnyResource && !rightIsAnyResource) {
      return 1;
    }
    if (rightIsAnyResource && !leftIsAnyResource) {
      return -1;
    }
    const leftResourceLength = left.resource.length;
    const rightResourceLength = right.resource.length;
    if (leftResourceLength > rightResourceLength) {
      return -1;
    }
    if (rightResourceLength > leftResourceLength) {
      return 1;
    }
    return 0;
  });

  return (request) => {
    for (const candidate of candidateArray) {
      const matchResult = candidate.match(request);
      if (!matchResult) {
        continue;
      }
      return candidate.callback(request, matchResult);
    }
    return null;
  };
};
