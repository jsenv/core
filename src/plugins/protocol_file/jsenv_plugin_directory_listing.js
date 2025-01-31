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
  urlToFilename,
  urlToRelativeUrl,
} from "@jsenv/urls";
import { existsSync, lstatSync, readdirSync } from "node:fs";
import { lookupPackageDirectory } from "../../helpers/lookup_package_directory.js";
import { replacePlaceholders } from "../injections/jsenv_plugin_injections.js";
import { FILE_AND_SERVER_URLS_CONVERTER } from "./file_and_server_urls_converter.js";

const htmlFileUrlForDirectory = new URL(
  "./client/directory_listing.html",
  import.meta.url,
);

export const jsenvPluginDirectoryListing = ({
  supervisorEnabled,
  directoryContentMagicName,
  directoryListingUrlMocks,
  autoreload = true,
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
    const request = urlInfo.context.request;
    const { rootDirectoryUrl, mainFilePath } = urlInfo.context;
    return replacePlaceholders(
      urlInfo.content,
      {
        ...generateDirectoryListingInjection(requestedUrl, {
          autoreload,
          request,
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

  return {
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
    serveWebsocket: ({ websocket, request, context }) => {
      if (!autoreload) {
        return false;
      }
      const secProtocol = request.headers["sec-websocket-protocol"];
      if (secProtocol !== "watch-directory") {
        return false;
      }
      const { rootDirectoryUrl, mainFilePath } = context;
      const requestedUrl = FILE_AND_SERVER_URLS_CONVERTER.asFileUrl(
        request.pathname,
        rootDirectoryUrl,
      );
      const closestDirectoryUrl = getFirstExistingDirectoryUrl(requestedUrl);
      const sendMessage = (message) => {
        websocket.send(JSON.stringify(message));
      };
      const generateItems = () => {
        const firstExistingDirectoryUrl = getFirstExistingDirectoryUrl(
          requestedUrl,
          rootDirectoryUrl,
        );
        const items = getDirectoryContentItems({
          serverRootDirectoryUrl: rootDirectoryUrl,
          mainFilePath,
          requestedUrl,
          firstExistingDirectoryUrl,
        });
        return items;
      };

      const unwatch = registerDirectoryLifecycle(closestDirectoryUrl, {
        added: ({ relativeUrl }) => {
          sendMessage({
            type: "change",
            reason: `${relativeUrl} added`,
            items: generateItems(),
          });
        },
        updated: ({ relativeUrl }) => {
          sendMessage({
            type: "change",
            reason: `${relativeUrl} updated`,
            items: generateItems(),
          });
        },
        removed: ({ relativeUrl }) => {
          sendMessage({
            type: "change",
            reason: `${relativeUrl} removed`,
            items: generateItems(),
          });
        },
      });
      websocket.signal.addEventListener("abort", () => {
        unwatch();
      });
      return true;
    },
  };
};

const generateDirectoryListingInjection = (
  requestedUrl,
  {
    rootDirectoryUrl,
    mainFilePath,
    request,
    directoryListingUrlMocks,
    directoryContentMagicName,
    autoreload,
    enoent,
  },
) => {
  let serverRootDirectoryUrl = rootDirectoryUrl;
  const firstExistingDirectoryUrl = getFirstExistingDirectoryUrl(
    requestedUrl,
    serverRootDirectoryUrl,
  );
  const directoryContentItems = getDirectoryContentItems({
    serverRootDirectoryUrl,
    mainFilePath,
    requestedUrl,
    firstExistingDirectoryUrl,
  });
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
  const directoryUrlRelativeToServer =
    FILE_AND_SERVER_URLS_CONVERTER.asServerUrl(
      firstExistingDirectoryUrl,
      serverRootDirectoryUrl,
    );
  const websocketScheme = request.protocol === "https" ? "wss" : "ws";
  const { host } = new URL(request.url);
  const websocketUrl = `${websocketScheme}://${host}${directoryUrlRelativeToServer}`;

  const navItems = [];
  nav_items: {
    const requestedRelativeUrl = urlToRelativeUrl(
      requestedUrl,
      rootDirectoryUrl,
    );
    const rootDirectoryUrlName = urlToFilename(rootDirectoryUrl);
    let parts;
    if (requestedRelativeUrl) {
      parts = `${rootDirectoryUrlName}/${requestedRelativeUrl}`.split("/");
    } else {
      parts = [rootDirectoryUrlName];
    }

    let i = 0;
    while (i < parts.length) {
      const part = parts[i];
      const isLastPart = i === parts.length - 1;
      if (isLastPart && part === "") {
        // ignore trailing slash
        break;
      }
      let navItemRelativeUrl = `${parts.slice(1, i + 1).join("/")}`;
      let navItemUrl =
        navItemRelativeUrl === ""
          ? rootDirectoryUrl
          : new URL(navItemRelativeUrl, rootDirectoryUrl).href;
      if (!isLastPart) {
        navItemUrl = ensurePathnameTrailingSlash(navItemUrl);
      }
      let urlRelativeToServer = FILE_AND_SERVER_URLS_CONVERTER.asServerUrl(
        navItemUrl,
        serverRootDirectoryUrl,
      );
      let urlRelativeToDocument = urlToRelativeUrl(navItemUrl, requestedUrl);
      const isServerRootDirectory = navItemUrl === serverRootDirectoryUrl;
      if (isServerRootDirectory) {
        urlRelativeToServer = `/${directoryContentMagicName}`;
        urlRelativeToDocument = `/${directoryContentMagicName}`;
      }
      const name = part;
      const isDirectory = navItemUrl.endsWith("/");
      const is404 = isDirectory
        ? urlIsInsideOf(navItemUrl, firstExistingDirectoryUrl)
        : enoent;
      const isCurrent = is404
        ? false
        : navItemUrl === String(firstExistingDirectoryUrl);
      navItems.push({
        url: navItemUrl,
        urlRelativeToServer,
        urlRelativeToDocument,
        isServerRootDirectory,
        isCurrent,
        name,
        is404,
      });
      i++;
    }
  }

  return {
    __DIRECTORY_LISTING__: {
      enoentDetails: enoent
        ? {
            fileUrl: requestedUrl,
          }
        : null,
      navItems,
      directoryListingUrlMocks,
      directoryContentMagicName,
      directoryUrl: firstExistingDirectoryUrl,
      serverRootDirectoryUrl,
      rootDirectoryUrl,
      mainFilePath,
      directoryContentItems,
      websocketUrl,
      autoreload,
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
const getDirectoryContentItems = ({
  serverRootDirectoryUrl,
  mainFilePath,
  firstExistingDirectoryUrl,
}) => {
  const directoryContentArray = readdirSync(new URL(firstExistingDirectoryUrl));
  const fileUrls = [];
  for (const filename of directoryContentArray) {
    const fileUrlObject = new URL(filename, firstExistingDirectoryUrl);
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
    const urlRelativeToCurrentDirectory = urlToRelativeUrl(
      fileUrl,
      firstExistingDirectoryUrl,
    );
    const urlRelativeToServer = FILE_AND_SERVER_URLS_CONVERTER.asServerUrl(
      fileUrl,
      serverRootDirectoryUrl,
    );
    const url = String(fileUrl);
    const mainFileUrl = new URL(mainFilePath, serverRootDirectoryUrl).href;
    const isMainFile = url === mainFileUrl;

    items.push({
      url,
      urlRelativeToCurrentDirectory,
      urlRelativeToServer,
      isMainFile,
    });
  }
  return items;
};
