import { readFileSync } from "node:fs";

const routeInspectorHtmlFileUrl = import.meta
  .resolve("./client/route_inspector.html");

export const jsenvServiceRouteInspector = () => {
  return {
    name: "jsenv:route_inspector",
    routes: [
      {
        endpoint: "GET /.internal/route_inspector",
        description:
          "Explore the routes available on this server using a web interface.",
        availableMediaTypes: ["text/html"],
        declarationSource: import.meta.url,
        fetch: () => {
          const inspectorHtml = readFileSync(
            new URL(routeInspectorHtmlFileUrl),
            "utf8",
          );
          return new Response(inspectorHtml, {
            headers: { "content-type": "text/html" },
          });
        },
      },
      {
        endpoint: "GET /.internal/routes.json",
        availableMediaTypes: ["application/json"],
        description: "Get the routes available on this server in JSON.",
        declarationSource: import.meta.url,
        fetch: (request, helpers) => {
          const routeJSON = helpers.router.inspect(request, helpers);
          return Response.json(routeJSON);
        },
      },
    ],
  };
};
