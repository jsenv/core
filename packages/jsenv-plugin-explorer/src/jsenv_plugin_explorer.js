import { collectFiles } from "@jsenv/filesystem";

export const explorerHtmlFileUrl = String(
  new URL("./client/explorer.html", import.meta.url),
);

export const jsenvPluginExplorer = ({
  pathname = "/",
  groups = {
    src: {
      "./**/*.html": true,
      "./**/*.test.html": false,
    },
    tests: {
      "./**/*.test.html": true,
    },
  },
} = {}) => {
  return {
    name: "jsenv:explorer",
    appliesDuring: "dev",
    resolveUrl: {
      http_request: (reference) => {
        if (
          reference.specifier === pathname ||
          reference.specifier === "__explorer__"
        ) {
          return explorerHtmlFileUrl;
        }
        return null;
      },
    },
    transformUrlContent: {
      html: async (urlInfo, context) => {
        if (urlInfo.url !== explorerHtmlFileUrl) {
          return null;
        }
        let html = urlInfo.content;
        if (html.includes("SERVER_PARAMS")) {
          const associationsForExplorable = {};
          Object.keys(groups).forEach((groupName) => {
            const groupConfig = groups[groupName];
            associationsForExplorable[groupName] = {
              "**/.jsenv/": false, // avoid visting .jsenv directory in jsenv itself
              ...groupConfig,
            };
          });
          const matchingFileResultArray = await collectFiles({
            directoryUrl: context.rootDirectoryUrl,
            associations: associationsForExplorable,
            predicate: (meta) =>
              Object.keys(meta).some((group) => Boolean(meta[group])),
          });
          const files = matchingFileResultArray.map(
            ({ relativeUrl, meta }) => ({
              relativeUrl,
              meta,
            }),
          );

          html = html.replace(
            "SERVER_PARAMS",
            JSON.stringify(
              {
                rootDirectoryUrl: context.rootDirectoryUrl,
                groups,
                files,
              },
              null,
              "  ",
            ),
          );
          Object.assign(urlInfo.headers, {
            "cache-control": "no-store",
          });
        }
        return html;
      },
    },
  };
};
