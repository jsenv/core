import { readFileSync } from "node:fs";

const routeInspectorHtmlFileUrl = import.meta.resolve(
  "./client/route_inspector.html",
);

export const jsenvServiceRouteInspector = (router) => {
  return {
    name: "jsenv:route_inspector",
    routes: [
      {
        endpoint: "GET /.internal/route_inspector",
        availableContentTypes: ["text/html"],
        response: () => {
          const inspectorHtml = readFileSync(
            new URL(routeInspectorHtmlFileUrl),
            "utf8",
          );
          return new Response(inspectorHtml, {
            headers: { "content-type": "html" },
          });
        },
      },
      {
        endpoint: "GET /.internal/route_inspector.json",
        availableContentTypes: ["application/json"],
        response: () => {
          const routeJSON = router.inspect();
          return Response.json(routeJSON);
        },
      },
    ],
  };
};
