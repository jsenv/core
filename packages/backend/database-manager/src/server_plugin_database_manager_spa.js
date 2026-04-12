import { readFileSync } from "node:fs";
import { replacePlaceholdersInHtml } from "./replace_placeholders_in_html.js";

const databaseManagerHtmlFileUrl = import.meta
  .resolve("./client/database_manager.html");

export const serverPluginDatabaseManagerSpa = ({ pathname }) => {
  return {
    name: "jsenv:database_manager_spa",
    routes: [
      // {
      //   endpoint: `GET ${pathname}app/*`,
      //   description: "Serve static files for database manager Web interface",
      //   declarationSource: import.meta.url,
      //   fetch: fetchFileSystem(import.meta.resolve("./client/"), {}),
      // },
      {
        endpoint: `GET ${pathname}`,
        description: "Manage database using a Web interface",
        declarationSource: import.meta.url,
        fetch: (request) => {
          if (request.pathname.startsWith(`${pathname}app/`)) {
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
                  apiUrl: new URL(`${pathname}api`, request.origin).href,
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
