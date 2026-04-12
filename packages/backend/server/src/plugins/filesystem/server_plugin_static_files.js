import { assertAndNormalizeDirectoryUrl } from "@jsenv/filesystem";
import { urlToExtension, urlToPathname } from "@jsenv/urls";
import { existsSync } from "node:fs";

import { createFileSystemFetch } from "./fetch_filesystem.js";

export const serverPluginStaticFiles = ({
  serverRelativeUrl = "/",
  directoryUrl,
  directoryMainFileRelativeUrl = "index.html",
  canReadDirectory = false,
  ...rest
}) => {
  // params validation
  {
    if (typeof serverRelativeUrl !== "string") {
      throw new TypeError(
        `serverRelativeUrl must be a string, got ${serverRelativeUrl}`,
      );
    }
    if (serverRelativeUrl[0] !== "/") {
      throw new TypeError(
        `serverRelativeUrl must start with /, got ${serverRelativeUrl}`,
      );
    }
    if (!serverRelativeUrl.endsWith("/")) {
      throw new TypeError(
        `serverRelativeUrl must end with /, got ${serverRelativeUrl}`,
      );
    }
    const unexpectedParamNames = Object.keys(rest);
    if (unexpectedParamNames.length > 0) {
      throw new TypeError(
        `${unexpectedParamNames.join(",")}: there is no such param`,
      );
    }
    directoryUrl = assertAndNormalizeDirectoryUrl(directoryUrl, "directoryUrl");
    if (directoryMainFileRelativeUrl) {
      if (typeof directoryMainFileRelativeUrl !== "string") {
        throw new TypeError(
          `buildDirectoryMainFileRelativeUrl must be a string, got ${directoryMainFileRelativeUrl}`,
        );
      }
      if (directoryMainFileRelativeUrl[0] === "/") {
        directoryMainFileRelativeUrl = directoryMainFileRelativeUrl.slice(1);
      } else {
        const buildMainFileUrl = new URL(
          directoryMainFileRelativeUrl,
          directoryUrl,
        ).href;
        if (!buildMainFileUrl.startsWith(directoryUrl)) {
          throw new Error(
            `directoryMainFileRelativeUrl must be relative, got ${directoryMainFileRelativeUrl}`,
          );
        }
        directoryMainFileRelativeUrl = buildMainFileUrl.slice(
          directoryUrl.length,
        );
      }
      if (!existsSync(new URL(directoryMainFileRelativeUrl, directoryUrl))) {
        directoryMainFileRelativeUrl = null;
      }
    }
  }

  return {
    name: "jsenv:static_files",
    routes: [
      {
        endpoint: `GET ${serverRelativeUrl}`,
        description: "Serve static files.",
        fetch: (request, helpers) => {
          const urlIsVersioned = new URL(request.url).searchParams.has("v");
          if (directoryMainFileRelativeUrl && request.resource === "/") {
            request = {
              ...request,
              resource: `/${directoryMainFileRelativeUrl}`,
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
            canReadDirectory,
            ENOENTFallback: () => {
              if (
                !urlToExtension(urlObject) &&
                !urlToPathname(urlObject).endsWith("/")
              ) {
                const mainFileUrl = new URL(
                  directoryMainFileRelativeUrl,
                  directoryUrl,
                );
                return mainFileUrl;
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
