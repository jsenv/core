/*
 * pourquoi le truc avec transformUrlContent et supervisor?
 * je devrait pouvoir modifier le contenu du html
 * mais je suppose qu'il faut que je le fasse avant que supervisor mette son nez dedans
 * donc dans fetchUrlContent? c'est pour ça? a confirmer
 */

import {
  comparePathnames,
  readEntryStatSync,
  registerDirectoryLifecycle,
} from "@jsenv/filesystem";
import { pickContentType } from "@jsenv/server";
import {
  asUrlWithoutSearch,
  ensurePathnameTrailingSlash,
  urlIsInsideOf,
} from "@jsenv/urls";
import { existsSync, lstatSync, readdirSync } from "node:fs";
import { lookupPackageDirectory } from "../../helpers/lookup_package_directory.js";
import { replacePlaceholders } from "../injections/jsenv_plugin_injections.js";

const htmlFileUrlForDirectory = new URL(
  "./client/directory_listing.html",
  import.meta.url,
);

export const jsenvPluginDirectoryListing = ({
  supervisorEnabled,
  directoryContentMagicName,
  directoryListingUrlMocks,
}) => {
  const extractDirectoryListingParams = (htmlUrlInfo) => {
    const urlWithoutSearch = asUrlWithoutSearch(htmlUrlInfo.url);
    if (urlWithoutSearch !== String(htmlFileUrlForDirectory)) {
      return null;
    }
    const requestedUrl = htmlUrlInfo.searchParams.get("url");
    if (!requestedUrl) {
      return null;
    }
    htmlUrlInfo.headers["cache-control"] = "no-cache";
    const enoent = htmlUrlInfo.searchParams.has("enoent");
    if (enoent) {
      htmlUrlInfo.status = 404;
      htmlUrlInfo.headers["cache-control"] = "no-cache";
    }
    return {
      requestedUrl,
      enoent,
    };
  };
  const replaceDirectoryListingPlaceholder = (
    urlInfo,
    { requestedUrl, enoent },
  ) => {
    const { rootDirectoryUrl, mainFilePath } = urlInfo.context;
    return replacePlaceholders(
      urlInfo.content,
      {
        ...generateDirectoryListingInjection(requestedUrl, {
          directoryListingUrlMocks,
          directoryContentMagicName,
          rootDirectoryUrl,
          mainFilePath,
          enoent,
        }),
      },
      urlInfo,
    );
  };

  return [
    {
      name: "jsenv:directory_listing",
      appliesDuring: "dev",
      redirectReference: (reference) => {
        if (reference.isInline) {
          return null;
        }
        const url = reference.url;
        if (!url.startsWith("file:")) {
          return null;
        }
        let { fsStat } = reference;
        if (!fsStat) {
          fsStat = readEntryStatSync(url, { nullIfNotFound: true });
          reference.fsStat = fsStat;
        }
        const { request } = reference.ownerUrlInfo.context;
        if (!fsStat) {
          if (
            reference.isDirectRequest &&
            request &&
            request.headers["sec-fetch-dest"] === "document"
          ) {
            return `${htmlFileUrlForDirectory}?url=${encodeURIComponent(url)}&enoent`;
          }
          return null;
        }
        const isDirectory = fsStat?.isDirectory();
        if (!isDirectory) {
          return null;
        }
        if (reference.type === "filesystem") {
          // TODO: we should redirect to something like /...json
          // and any file name ...json is a special file serving directory content as json
          return null;
        }
        const acceptsHtml = request
          ? pickContentType(request, ["text/html"])
          : false;
        if (!acceptsHtml) {
          return null;
        }
        reference.fsStat = null; // reset fsStat, now it's not a directory anyor
        return `${htmlFileUrlForDirectory}?url=${encodeURIComponent(url)}`;
      },
      // when supervisor is enabled html does not contain placeholder anymore
      transformUrlContent: supervisorEnabled
        ? {
            js_classic: (urlInfo) => {
              const parentUrlInfo = urlInfo.findParentIfInline();
              if (!parentUrlInfo) {
                return null;
              }
              const directoryListingParams =
                extractDirectoryListingParams(parentUrlInfo);
              if (!directoryListingParams) {
                return null;
              }
              return replaceDirectoryListingPlaceholder(
                urlInfo,
                directoryListingParams,
              );
            },
          }
        : {
            html: (urlInfo) => {
              const directoryListingParams =
                extractDirectoryListingParams(urlInfo);
              if (!directoryListingParams) {
                return null;
              }
              return replaceDirectoryListingPlaceholder(
                urlInfo,
                directoryListingParams,
              );
            },
          },
      serveWebsocket: ({ websocket, request }) => {
        if (request.headers["sec-websocket-protocol"] !== "watch_directory") {
          return false;
        }
        const directoryUrl = request.url;
        const sendMessage = (message) => {
          websocket.send(JSON.stringify(message));
        };
        const unwatch = registerDirectoryLifecycle(directoryUrl, {
          added: ({ relativeUrl }) => {
            sendMessage({
              type: "change",
              reason: `${relativeUrl} added`,
              items: getDirectoryContentItems(directoryUrl),
            });
          },
          updated: ({ relativeUrl }) => {
            sendMessage({
              type: "change",
              reason: `${relativeUrl} updated`,
              items: getDirectoryContentItems(directoryUrl),
            });
          },
          removed: ({ relativeUrl }) => {
            sendMessage({
              type: "change",
              reason: `${relativeUrl} removed`,
              items: getDirectoryContentItems(directoryUrl),
            });
          },
        });
        websocket.signal.addEventListener("abort", () => {
          unwatch();
        });
        return true;
      },
    },
    {
      name: "jsenv:directory_as_json",
      appliesDuring: "*",
      fetchUrlContent: (urlInfo) => {
        const { firstReference } = urlInfo;
        let { fsStat } = firstReference;
        if (!fsStat) {
          fsStat = readEntryStatSync(urlInfo.url, { nullIfNotFound: true });
        }
        if (!fsStat) {
          return null;
        }
        const isDirectory = fsStat.isDirectory();
        if (!isDirectory) {
          return null;
        }
        const directoryContentArray = readdirSync(new URL(urlInfo.url));
        const content = JSON.stringify(directoryContentArray, null, "  ");
        return {
          type: "directory",
          contentType: "application/json",
          content,
        };
      },
    },
  ];
};

const generateDirectoryListingInjection = (
  requestedUrl,
  {
    enoent,
    directoryListingUrlMocks,
    directoryContentMagicName,
    rootDirectoryUrl,
    mainFilePath,
  },
) => {
  let serverRootDirectoryUrl = rootDirectoryUrl;
  const firstExistingDirectoryUrl = getFirstExistingDirectoryUrl(
    requestedUrl,
    serverRootDirectoryUrl,
  );
  const directoryContentItems = getDirectoryContentItems(
    firstExistingDirectoryUrl,
  );
  package_workspaces: {
    const packageDirectoryUrl = lookupPackageDirectory(serverRootDirectoryUrl);
    if (!packageDirectoryUrl) {
      break package_workspaces;
    }
    if (String(packageDirectoryUrl) === String(serverRootDirectoryUrl)) {
      break package_workspaces;
    }
    rootDirectoryUrl = packageDirectoryUrl;
    // if (String(firstExistingDirectoryUrl) === String(serverRootDirectoryUrl)) {
    //   let packageContent;
    //   try {
    //     packageContent = JSON.parse(
    //       readFileSync(new URL("package.json", packageDirectoryUrl), "utf8"),
    //     );
    //   } catch {
    //     break package_workspaces;
    //   }
    //   const { workspaces } = packageContent;
    //   if (Array.isArray(workspaces)) {
    //     for (const workspace of workspaces) {
    //       const workspaceUrlObject = new URL(workspace, packageDirectoryUrl);
    //       const workspaceUrl = workspaceUrlObject.href;
    //       if (workspaceUrl.endsWith("*")) {
    //         const directoryUrl = ensurePathnameTrailingSlash(
    //           workspaceUrl.slice(0, -1),
    //         );
    //         fileUrls.push(new URL(directoryUrl));
    //       } else {
    //         fileUrls.push(ensurePathnameTrailingSlash(workspaceUrlObject));
    //       }
    //     }
    //   }
    // }
  }
  return {
    __DIRECTORY_LISTING__: {
      enoentDetails: enoent
        ? {
            fileUrl: requestedUrl,
          }
        : null,
      directoryListingUrlMocks,
      directoryContentMagicName,
      directoryUrl: firstExistingDirectoryUrl,
      serverRootDirectoryUrl,
      rootDirectoryUrl,
      mainFilePath,
      directoryContentItems,
    },
  };
};
const getFirstExistingDirectoryUrl = (requestedUrl, serverRootDirectoryUrl) => {
  let firstExistingDirectoryUrl = new URL("./", requestedUrl);
  while (!existsSync(firstExistingDirectoryUrl)) {
    firstExistingDirectoryUrl = new URL("../", firstExistingDirectoryUrl);
    if (!urlIsInsideOf(firstExistingDirectoryUrl, serverRootDirectoryUrl)) {
      firstExistingDirectoryUrl = new URL(serverRootDirectoryUrl);
      break;
    }
  }
  return firstExistingDirectoryUrl;
};
const getDirectoryContentItems = (directoryUrl) => {
  const directoryContentArray = readdirSync(directoryUrl);
  const fileUrls = [];
  for (const filename of directoryContentArray) {
    const fileUrlObject = new URL(filename, directoryUrl);
    if (lstatSync(fileUrlObject).isDirectory()) {
      fileUrls.push(ensurePathnameTrailingSlash(fileUrlObject));
    } else {
      fileUrls.push(fileUrlObject);
    }
  }
  fileUrls.sort((a, b) => {
    return comparePathnames(a.pathname, b.pathname);
  });
  const items = [];
  for (const fileUrl of fileUrls) {
    items.push({
      url: String(fileUrl),
    });
  }
  return items;
};
