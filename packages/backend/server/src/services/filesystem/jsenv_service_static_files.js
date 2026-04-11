import { urlToExtension, urlToPathname } from "@jsenv/urls";

import { createFileSystemFetch } from "./fetch_filesystem.js";

export const jsenvServiceStaticFiles = ({ directoryUrl, mainFilePath }) => {
  return {
    name: "jsenv:file_service",
    routes: [
      {
        endpoint: "GET *",
        description: "Serve static files.",
        fetch: (request, helpers) => {
          const urlIsVersioned = new URL(request.url).searchParams.has("v");
          if (mainFilePath && request.resource === "/") {
            request = {
              ...request,
              resource: `/${mainFilePath}`,
            };
          }
          const urlObject = new URL(request.resource.slice(1), directoryUrl);
          return createFileSystemFetch(directoryUrl, {
            cacheControl: urlIsVersioned
              ? `private,max-age=${SECONDS_IN_30_DAYS},immutable`
              : "private,max-age=0,must-revalidate",
            etagEnabled: true,
            compressionEnabled: true,
            rootDirectoryUrl: directoryUrl,
            canReadDirectory: true,
            ENOENTFallback: () => {
              if (
                !urlToExtension(urlObject) &&
                !urlToPathname(urlObject).endsWith("/")
              ) {
                return new URL(mainFilePath, directoryUrl);
              }
              return null;
            },
          })(request, helpers);
        },
      },
    ],
  };
};
const SECONDS_IN_30_DAYS = 60 * 60 * 24 * 30;
