/*
 * pourquoi le truc avec transformUrlContent et supervisor?
 * je devrait pouvoir modifier le contenu du html
 * mais je suppose qu'il faut que je le fasse avant que supervisor mette son nez dedans
 * donc dans fetchUrlContent? c'est pour ça? a confirmer
 */

import { comparePathnames, readEntryStatSync } from "@jsenv/filesystem";
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

  return {
    name: "jsenv:directory_listing",
    appliesDuring: "*",
    redirectReference: (reference) => {
      const { build, request } = reference.ownerUrlInfo.context;
      if (build) {
        return null;
      }
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
      if (!fsStat) {
        if (request && request.headers["sec-fetch-dest"] === "document") {
          reference.addImplicit({
            type: "404",
            specifier: url,
            isWeak: true,
          });
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
      return `${htmlFileUrlForDirectory}?url=${encodeURIComponent(url)}`;
    },
    fetchUrlContent: (urlInfo) => {
      const { firstReference } = urlInfo;
      let { fsStat } = firstReference;
      if (!fsStat) {
        fsStat = readEntryStatSync(urlInfo.url, { nullIfNotFound: true });
      }
      const isDirectory = fsStat?.isDirectory();
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
  };
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
  let firstExistingDirectoryUrl = new URL("./", requestedUrl);
  while (!existsSync(firstExistingDirectoryUrl)) {
    firstExistingDirectoryUrl = new URL("../", firstExistingDirectoryUrl);
    if (!urlIsInsideOf(firstExistingDirectoryUrl, serverRootDirectoryUrl)) {
      firstExistingDirectoryUrl = new URL(serverRootDirectoryUrl);
      break;
    }
  }
  const directoryContentArray = readdirSync(firstExistingDirectoryUrl);
  const fileUrls = [];
  for (const filename of directoryContentArray) {
    const fileUrlObject = new URL(filename, firstExistingDirectoryUrl);
    fileUrls.push(fileUrlObject);
  }
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
  const sortedUrls = [];
  for (let fileUrl of fileUrls) {
    if (lstatSync(fileUrl).isDirectory()) {
      sortedUrls.push(ensurePathnameTrailingSlash(fileUrl));
    } else {
      sortedUrls.push(fileUrl);
    }
  }
  sortedUrls.sort((a, b) => {
    return comparePathnames(a.pathname, b.pathname);
  });

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
      directoryContentItems: sortedUrls,
    },
  };
};
