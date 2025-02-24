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
        injectResponseHeader: () => {},
      });
      return response;
    },
    // TODO: test to send an OPTIONS with '*' in that case we want to check for any route o
    injectResponseHeaders: (response, { request }) => {
      if (request.method !== "OPTIONS") {
        return null;
      }
      const {
        allowedMethodSet,
        acceptedContentTypeSet,
        postAcceptedContentTypeSet,
        patchAcceptedContentTypeSet,
      } = router.matchOptions(request);

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
        headers["accept-patch"] = Array.from(patchAcceptedContentTypeSet).join(
          ", ",
        );
      }
      if (allowedMethodSet.size) {
        headers["allow"] = Array.from(allowedMethodSet).join(", ");
      }
      return headers;
    },
  };
};
