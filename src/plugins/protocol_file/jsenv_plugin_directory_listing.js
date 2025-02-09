/*
 * NICE TO HAVE:
 * 
 * - when clicking the server root directory from the root directory 
 * we should see "/..." in the url bar
 * instead we ses "@fs/"
 * everything still works but that would be cleaner
 * 
 * - when visiting urls outside server root directory the UI is messed up
 * 
 * Let's say I visit file outside the server root directory that is in 404
 * We must update the enoent message and maybe other things to take into account
 * that url is no longer /something but "@fs/project_root/something" in the browser url bar
 * 
 * - watching directory might result into things that are not properly handled:
 * 1. the existing directory is deleted
 *    -> we should update the whole page to use a new "firstExistingDirectoryUrl"
 * 2. the enoent is impacted
 *    -> we should update the ENOENT message
 * It means the websocket should contain more data and we can't assume firstExistingDirectoryUrl won't change
 *

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
  urlMocks = false,
  autoreload = true,
  directoryContentMagicName,
}) => {
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
      const { request, requestedUrl } = reference.ownerUrlInfo.context;
      if (!fsStat) {
        if (
          requestedUrl === url &&
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
    transformUrlContent: {
      html: (urlInfo) => {
        const urlWithoutSearch = asUrlWithoutSearch(urlInfo.url);
        if (urlWithoutSearch !== String(htmlFileUrlForDirectory)) {
          return null;
        }
        const requestedUrl = urlInfo.searchParams.get("url");
        if (!requestedUrl) {
          return null;
        }
        urlInfo.headers["cache-control"] = "no-cache";
        const enoent = urlInfo.searchParams.has("enoent");
        if (enoent) {
          urlInfo.status = 404;
          urlInfo.headers["cache-control"] = "no-cache";
        }
        const request = urlInfo.context.request;
        const { rootDirectoryUrl, mainFilePath } = urlInfo.context;
        return replacePlaceholders(
          urlInfo.content,
          {
            ...generateDirectoryListingInjection(requestedUrl, {
              autoreload,
              request,
              urlMocks,
              directoryContentMagicName,
              rootDirectoryUrl,
              mainFilePath,
              enoent,
            }),
          },
          urlInfo,
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
    urlMocks,
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
    const lastItemUrl = firstExistingDirectoryUrl;
    const lastItemRelativeUrl = urlToRelativeUrl(lastItemUrl, rootDirectoryUrl);
    const rootDirectoryUrlName = urlToFilename(rootDirectoryUrl);
    let parts;
    if (lastItemRelativeUrl) {
      parts = `${rootDirectoryUrlName}/${lastItemRelativeUrl}`.split("/");
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
      const isCurrent = navItemUrl === String(firstExistingDirectoryUrl);
      navItems.push({
        url: navItemUrl,
        urlRelativeToServer,
        urlRelativeToDocument,
        isServerRootDirectory,
        isCurrent,
        name,
      });
      i++;
    }
  }

  let enoentDetails = null;
  if (enoent) {
    const fileRelativeUrl = urlToRelativeUrl(
      requestedUrl,
      serverRootDirectoryUrl,
    );
    let filePathExisting;
    let filePathNotFound;
    const existingIndex = String(firstExistingDirectoryUrl).length;
    filePathExisting = urlToRelativeUrl(
      firstExistingDirectoryUrl,
      serverRootDirectoryUrl,
    );
    filePathNotFound = requestedUrl.slice(existingIndex);
    enoentDetails = {
      fileUrl: requestedUrl,
      fileRelativeUrl,
      filePathExisting: `/${filePathExisting}`,
      filePathNotFound,
    };
  }

  return {
    __DIRECTORY_LISTING__: {
      enoentDetails,
      navItems,
      urlMocks,
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
