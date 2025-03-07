import { urlToFileSystemPath } from "@jsenv/urls";
import { createRequire } from "node:module";

export const jsenvServiceOpenFile = () => {
  return {
    routes: [
      {
        endpoint: "GET /.internal/open_file/*",
        description: "Can be used to open a given file in your editor.",
        declarationLocation: import.meta.url,
        fetch: (request, { kitchen }) => {
          let file = decodeURIComponent(request.params[0]);
          if (!file) {
            return {
              status: 400,
              body: "Missing file in url",
            };
          }
          const fileUrl = new URL(file, kitchen.context.rootDirectoryUrl);
          const filePath = urlToFileSystemPath(fileUrl);
          const require = createRequire(import.meta.url);
          const launch = require("launch-editor");
          launch(filePath, () => {
            // ignore error for now
          });
          return {
            status: 200,
            headers: {
              "cache-control": "no-store",
            },
          };
        },
      },
    ],
  };
};
