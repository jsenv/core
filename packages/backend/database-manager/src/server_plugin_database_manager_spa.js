import { createFileSystemFetch } from "@jsenv/server";
import { readFileSync } from "node:fs";

const databaseManagerHtmlFileUrl = import.meta
  .resolve("./client/database_manager.html");
const assetDirectoryUrl = import.meta.resolve("./client/assets/");

export const serverPluginDatabaseManagerSpa = ({
  pathname,
  sourceDirectoryUrl,
}) => {
  // ensure no trailing slash
  pathname = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  return {
    name: "jsenv:database_manager_spa",
    routes: [
      {
        endpoint: `GET ${pathname}/assets/*`,
        description: "Serve static files for database manager Web interface",
        declarationSource: import.meta.url,
        fetch: createFileSystemFetch(assetDirectoryUrl),
      },

      {
        endpoint: `GET ${pathname}/`,
        description: "Manage database using a Web interface",
        declarationSource: import.meta.url,
        fetch: (request) => {
          const apiServerUrl = new URL(`${pathname}/api`, request.origin).href;
          const htmlManagerRaw = readFileSync(
            new URL(databaseManagerHtmlFileUrl),
            "utf8",
          );
          const htmlManagerModified = replacePlaceholdersInHtml(
            htmlManagerRaw,
            {
              __DB_MANAGER_CONFIG__: {
                pathname,
                apiUrl: apiServerUrl,
              },
              ...(sourceDirectoryUrl
                ? {
                    "./assets/database_manager.jsx": () => {
                      const sourceDir = sourceDirectoryUrl.endsWith("/")
                        ? sourceDirectoryUrl
                        : `${sourceDirectoryUrl}/`;
                      return `/${assetDirectoryUrl.slice(sourceDir.length)}database_manager.jsx`;
                    },
                  }
                : {}),
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
    const replacement =
      typeof value === "string" ? value : JSON.stringify(value);
    html = html.replaceAll(name, replacement);
  }
  return html;
};
