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
        description:
          "Explore the routes available on this server using a web interface.",
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
        endpoint: "GET /.internal/routes.json",
        availableContentTypes: ["application/json"],
        description: "Get the routes available on this server in JSON.",
        response: (request, helpers) => {
          const routeJSON = router.inspect(request, helpers);
          return Response.json(routeJSON);
        },
      },
    ],
  };
};
