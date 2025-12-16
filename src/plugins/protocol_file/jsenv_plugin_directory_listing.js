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
  compareFileUrls,
  readEntryStatSync,
  registerDirectoryLifecycle,
} from "@jsenv/filesystem";
import { pickContentType, WebSocketResponse } from "@jsenv/server";
import {
  asUrlWithoutSearch,
  ensurePathnameTrailingSlash,
  urlIsOrIsInsideOf,
  urlToFilename,
  urlToRelativeUrl,
} from "@jsenv/urls";
import { existsSync, lstatSync, readdirSync } from "node:fs";
import { getDirectoryWatchPatterns } from "../../helpers/watch_source_files.js";
import { FILE_AND_SERVER_URLS_CONVERTER } from "../../kitchen/file_and_server_urls_converter.js";

const htmlFileUrlForDirectory = import.meta
  .resolve("./client/directory_listing.html");

export const jsenvPluginDirectoryListing = ({
  spa,
  urlMocks = false,
  autoreload = true,
  directoryContentMagicName,
  packageDirectory,
  rootDirectoryUrl,
  mainFilePath,
  sourceFilesConfig,
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
      const { request, requestedUrl, mainFilePath, rootDirectoryUrl } =
        reference.ownerUrlInfo.context;
      if (!fsStat) {
        if (!request || request.headers["sec-fetch-dest"] !== "document") {
          return null;
        }
        if (url !== requestedUrl) {
          const mainFileUrl = new URL(mainFilePath, rootDirectoryUrl);
          mainFileUrl.search = "";
          mainFileUrl.hash = "";
          const referenceUrl = new URL(url);
          referenceUrl.search = "";
          referenceUrl.hash = "";
          if (mainFileUrl.href !== referenceUrl.href) {
            return null;
          }
        }
        return `${htmlFileUrlForDirectory}?url=${encodeURIComponent(requestedUrl)}&enoent`;
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
        const urlNotFound = urlInfo.searchParams.get("url");
        if (!urlNotFound) {
          return null;
        }

        urlInfo.headers["cache-control"] = "no-cache";
        const enoent = urlInfo.searchParams.has("enoent");
        if (enoent) {
          urlInfo.status = 404;
        }
        const request = urlInfo.context.request;
        const { rootDirectoryUrl, mainFilePath } = urlInfo.context;
        const directoryListingInjections = generateDirectoryListingInjection(
          urlNotFound,
          {
            spa,
            autoreload,
            request,
            urlMocks,
            directoryContentMagicName,
            rootDirectoryUrl,
            mainFilePath,
            packageDirectory,
            enoent,
          },
        );
        return {
          contentInjections: directoryListingInjections,
        };
      },
    },
    devServerRoutes: [
      {
        endpoint:
          "GET /.internal/directory_content.websocket?directory=:directory",
        description: "Emit events when a directory content changes.",
        declarationSource: import.meta.url,
        fetch: (request) => {
          if (!autoreload) {
            return null;
          }
          return new WebSocketResponse((websocket) => {
            const directoryRelativeUrl = request.params.directory;
            const requestedUrl = FILE_AND_SERVER_URLS_CONVERTER.asFileUrl(
              directoryRelativeUrl,
              rootDirectoryUrl,
            );
            const closestDirectoryUrl = getFirstExistingDirectoryUrl(
              requestedUrl,
              rootDirectoryUrl,
            );
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
              watchPatterns: getDirectoryWatchPatterns(
                closestDirectoryUrl,
                closestDirectoryUrl,
                {
                  sourceFilesConfig,
                },
              ),
            });
            return () => {
              unwatch();
            };
          });
        },
      },
    ],
  };
};

const generateDirectoryListingInjection = (
  urlNotFound,
  {
    spa,
    rootDirectoryUrl,
    mainFilePath,
    packageDirectory,
    request,
    urlMocks,
    directoryContentMagicName,
    autoreload,
    enoent,
  },
) => {
  let serverRootDirectoryUrl = rootDirectoryUrl;
  const firstExistingDirectoryUrl = getFirstExistingDirectoryUrl(
    urlNotFound,
    serverRootDirectoryUrl,
  );
  const directoryContentItems = getDirectoryContentItems({
    serverRootDirectoryUrl,
    mainFilePath,
    firstExistingDirectoryUrl,
  });
  package_workspaces: {
    if (!packageDirectory.url) {
      break package_workspaces;
    }
    if (String(packageDirectory.url) === String(serverRootDirectoryUrl)) {
      break package_workspaces;
    }
    rootDirectoryUrl = packageDirectory.url;
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
  const websocketUrl = `${websocketScheme}://${host}/.internal/directory_content.websocket?directory=${encodeURIComponent(directoryUrlRelativeToServer)}`;

  const generateBreadcrumb = () => {
    const breadcrumb = [];
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
      let urlRelativeToDocument = urlToRelativeUrl(navItemUrl, urlNotFound);
      const isServerRootDirectory = navItemUrl === serverRootDirectoryUrl;
      if (isServerRootDirectory) {
        urlRelativeToServer = `/${directoryContentMagicName}`;
        urlRelativeToDocument = `/${directoryContentMagicName}`;
      }
      const name = part;
      const isCurrent = navItemUrl === String(firstExistingDirectoryUrl);
      breadcrumb.push({
        url: navItemUrl,
        urlRelativeToServer,
        urlRelativeToDocument,
        isServerRootDirectory,
        isCurrent,
        name,
      });
      i++;
    }
    return breadcrumb;
  };
  const breadcrumb = generateBreadcrumb(urlNotFound);

  let enoentDetails = null;
  if (enoent) {
    const buildEnoentPathInfo = (urlBase, closestExistingUrl) => {
      let filePathExisting;
      let filePathNotFound;
      const existingIndex = String(closestExistingUrl).length;
      filePathExisting = urlToRelativeUrl(
        closestExistingUrl,
        serverRootDirectoryUrl,
      );
      filePathNotFound = urlBase.slice(existingIndex);
      return [filePathExisting, filePathNotFound];
    };
    const fileRelativeUrl = urlToRelativeUrl(
      urlNotFound,
      serverRootDirectoryUrl,
    );
    enoentDetails = {
      fileUrl: urlNotFound,
      fileRelativeUrl,
    };

    const [filePathExisting, filePathNotFound] = buildEnoentPathInfo(
      urlNotFound,
      firstExistingDirectoryUrl,
    );
    Object.assign(enoentDetails, {
      filePathExisting: `/${filePathExisting}`,
      filePathNotFound,
    });
  }

  return {
    __DIRECTORY_LISTING__: {
      spa,
      enoentDetails,
      breadcrumb,
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
const getFirstExistingDirectoryUrl = (urlBase, serverRootDirectoryUrl) => {
  let directoryUrlCandidate = new URL("./", urlBase);
  while (!existsSync(directoryUrlCandidate)) {
    directoryUrlCandidate = new URL("../", directoryUrlCandidate);
    if (!urlIsOrIsInsideOf(directoryUrlCandidate, serverRootDirectoryUrl)) {
      directoryUrlCandidate = new URL(serverRootDirectoryUrl);
      break;
    }
  }
  return directoryUrlCandidate;
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
  fileUrls.sort(compareFileUrls);

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
