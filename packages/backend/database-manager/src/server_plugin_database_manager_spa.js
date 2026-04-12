import { createFileSystemFetch } from "@jsenv/server";
import { readFileSync } from "node:fs";

const databaseManagerHtmlFileUrl = import.meta
  .resolve("./client/database_manager.html");

export const serverPluginDatabaseManagerSpa = ({
  pathname,
  redirectToSource,
}) => {
  const apiUrl = new URL(`${pathname}api`, import.meta.url).href;

  return {
    name: "jsenv:database_manager_spa",
    routes: [
      {
        endpoint: `GET ${pathname}assets/*`,
        description: "Serve static files for database manager Web interface",
        declarationSource: import.meta.url,
        fetch: redirectToSource
          ? (request) => {
              return new Response(null, {
                status: 302,
                headers: {
                  location: new URL(
                    request.pathname,
                    import.meta.resolve("./client/assets/"),
                  ).href,
                },
              });
            }
          : createFileSystemFetch(import.meta.resolve("./client/assets/")),
      },

      {
        endpoint: `GET ${pathname}`,
        description: "Manage database using a Web interface",
        declarationSource: import.meta.url,
        fetch: (request) => {
          if (request.pathname.startsWith(`${pathname}assets/`)) {
            // let the static files be handled (by jsenv dev server or a static file service)
            return undefined;
          }
          const htmlManagerRaw = readFileSync(
            new URL(databaseManagerHtmlFileUrl),
            "utf8",
          );
          const htmlManagerModified = replacePlaceholdersInHtml(
            htmlManagerRaw,
            {
              __DB_MANAGER_CONFIG__: () => {
                return {
                  pathname,
                  apiUrl,
                };
              },
            },
          );
          return new Response(htmlManagerModified, {
            headers: { "content-type": "text/html" },
          });
        },
      },
    ],
  };
};

const replacePlaceholdersInHtml = (html, replacers) => {
  for (const [name, replacer] of Object.entries(replacers)) {
    const value = typeof replacer === "function" ? replacer() : replacer;
    html = html.replaceAll(name, JSON.stringify(value));
  }
  return html;
};
