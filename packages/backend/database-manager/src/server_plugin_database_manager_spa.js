import { createFileSystemFetch } from "@jsenv/server";
import { readFileSync } from "node:fs";

const databaseManagerHtmlFileUrl = import.meta
  .resolve("./client/database_manager.html");

export const serverPluginDatabaseManagerSpa = ({
  pathname,
  sourceDirectoryUrl,
}) => {
  const apiUrl = new URL(`${pathname}api`, import.meta.url).href;

  return {
    name: "jsenv:database_manager_spa",
    routes: [
      {
        endpoint: `GET ${pathname}assets/*`,
        description: "Serve static files for database manager Web interface",
        declarationSource: import.meta.url,
        fetch: sourceDirectoryUrl
          ? (request) => {
              const assetPathname = request.pathname.slice(
                `${pathname}assets`.length,
              );
              const assetFileUrl = new URL(
                `.${assetPathname}`,
                import.meta.resolve("./client/assets/"),
              );
              const assetRelativeToSourceDir = assetFileUrl.href.slice(
                sourceDirectoryUrl.endsWith("/")
                  ? sourceDirectoryUrl.length
                  : sourceDirectoryUrl.length + 1,
              );
              const assetServerUrl = `${request.origin}/${assetRelativeToSourceDir}`;
              return Response.redirect(assetServerUrl, 302);
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
