import {
  assertAndNormalizeDirectoryUrl,
  comparePathnames,
  readEntryStatSync,
} from "@jsenv/filesystem";
import { pickContentType } from "@jsenv/server";
import {
  ensurePathnameTrailingSlash,
  urlIsInsideOf,
  urlToExtension,
  urlToFilename,
  urlToPathname,
  urlToRelativeUrl,
} from "@jsenv/urls";
import { CONTENT_TYPE } from "@jsenv/utils/src/content_type/content_type.js";
import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { lookupPackageDirectory } from "../../helpers/lookup_package_directory.js";
import { jsenvCoreDirectoryUrl } from "../../jsenv_core_directory_url.js";
import { jsenvPluginFsRedirection } from "./jsenv_plugin_fs_redirection.js";

const html404AndAncestorDirFileUrl = new URL(
  "./client/html_404_and_ancestor_dir.html",
  import.meta.url,
);
const htmlFileUrlForDirectory = new URL(
  "./client/directory.html",
  import.meta.url,
);

export const jsenvPluginProtocolFile = ({
  magicExtensions,
  magicDirectoryIndex,
  preserveSymlinks,
  directoryListingUrlMocks,
}) => {
  return [
    jsenvPluginFsRedirection({
      magicExtensions,
      magicDirectoryIndex,
      preserveSymlinks,
    }),
    {
      name: "jsenv:fs_resolution",
      appliesDuring: "*",
      resolveReference: {
        filesystem: (reference) => {
          const ownerUrlInfo = reference.ownerUrlInfo;
          const baseUrl =
            ownerUrlInfo.type === "directory"
              ? ensurePathnameTrailingSlash(ownerUrlInfo.url)
              : ownerUrlInfo.url;
          return new URL(reference.specifier, baseUrl).href;
        },
      },
    },
    {
      name: "jsenv:@fs",
      // during build it's fine to use "file://"" urls
      // but during dev it's a browser running the code
      // so absolute file urls needs to be relativized
      appliesDuring: "dev",
      resolveReference: (reference) => {
        if (reference.specifier.startsWith("/@fs/")) {
          const fsRootRelativeUrl = reference.specifier.slice("/@fs/".length);
          return `file:///${fsRootRelativeUrl}`;
        }
        return null;
      },
      formatReference: (reference) => {
        const { generatedUrl } = reference;
        if (!generatedUrl.startsWith("file:")) {
          return null;
        }
        const { rootDirectoryUrl } = reference.ownerUrlInfo.context;
        if (urlIsInsideOf(generatedUrl, rootDirectoryUrl)) {
          const result = `/${urlToRelativeUrl(generatedUrl, rootDirectoryUrl)}`;
          return result;
        }
        const result = `/@fs/${generatedUrl.slice("file:///".length)}`;
        return result;
      },
    },
    {
      name: "jsenv:file_url_fetching",
      appliesDuring: "*",
      fetchUrlContent: (urlInfo) => {
        if (!urlInfo.url.startsWith("file:")) {
          return null;
        }
        const { firstReference } = urlInfo;
        let { fsStat } = firstReference;
        if (!fsStat) {
          fsStat = readEntryStatSync(urlInfo.url, { nullIfNotFound: true });
        }
        const isDirectory = fsStat?.isDirectory();
        const { rootDirectoryUrl, request } = urlInfo.context;
        const serveFile = (url) => {
          const contentType = CONTENT_TYPE.fromUrlExtension(url);
          const fileBuffer = readFileSync(new URL(url));
          const content = CONTENT_TYPE.isTextual(contentType)
            ? String(fileBuffer)
            : fileBuffer;
          return {
            content,
            contentType,
            contentLength: fileBuffer.length,
          };
        };

        // for SPA we want to serve the root HTML file only when:
        // 1. There is no corresponding file on the filesystem
        // 2. The url pathname does not have an extension
        //    This point assume client is requesting a file when there is an extension
        //    and it assumes all routes will not use extension
        // 3. The url pathname does not ends with "/"
        //    In that case we assume client explicitely asks to load a directory
        if (!fsStat) {
          if (
            !urlToExtension(urlInfo.url) &&
            !urlToPathname(urlInfo.url).endsWith("/")
          ) {
            const { mainFilePath, rootDirectoryUrl } = urlInfo.context;
            return serveFile(new URL(mainFilePath, rootDirectoryUrl));
          }
          if (request && request.headers["sec-fetch-dest"] === "document") {
            const directoryContentItems = generateDirectoryContentItems(
              urlInfo.url,
              rootDirectoryUrl,
            );
            const html = generateHtmlForENOENT(
              urlInfo.url,
              directoryContentItems,
              directoryListingUrlMocks,
            );
            return {
              status: 404,
              contentType: "text/html",
              content: html,
              headers: {
                "cache-control": "no-cache",
              },
            };
          }
        }
        if (isDirectory) {
          const directoryContentArray = readdirSync(new URL(urlInfo.url));
          if (firstReference.type === "filesystem") {
            const content = JSON.stringify(directoryContentArray, null, "  ");
            return {
              type: "directory",
              contentType: "application/json",
              content,
            };
          }
          const acceptsHtml = request
            ? pickContentType(request, ["text/html"])
            : false;
          if (acceptsHtml) {
            firstReference.expectedType = "html";
            const directoryUrl = urlInfo.url;
            const directoryContentItems = generateDirectoryContentItems(
              directoryUrl,
              rootDirectoryUrl,
            );
            const html = generateHtmlForDirectory(directoryContentItems);
            return {
              type: "html",
              contentType: "text/html",
              content: html,
            };
          }
          return {
            type: "directory",
            contentType: "application/json",
            content: JSON.stringify(directoryContentArray, null, "  "),
          };
        }
        return serveFile(urlInfo.url);
      },
    },
  ];
};

const generateHtmlForDirectory = (directoryContentItems) => {
  let directoryUrl = directoryContentItems.firstExistingDirectoryUrl;
  const rootDirectoryUrl = directoryContentItems.rootDirectoryUrl;
  directoryUrl = assertAndNormalizeDirectoryUrl(directoryUrl);

  const htmlForDirectory = String(readFileSync(htmlFileUrlForDirectory));
  const directoryRelativeUrl = urlToRelativeUrl(directoryUrl, rootDirectoryUrl);
  const replacers = {
    directoryUrl,
    directoryNav: () =>
      generateDirectoryNav(directoryRelativeUrl, rootDirectoryUrl),
    directoryContent: () => generateDirectoryContent(directoryContentItems),
  };
  const html = replacePlaceholders(htmlForDirectory, replacers);
  return html;
};
const generateHtmlForENOENT = (
  url,
  directoryContentItems,
  directoryListingUrlMocks,
) => {
  const ancestorDirectoryUrl = directoryContentItems.firstExistingDirectoryUrl;
  const rootDirectoryUrl = directoryContentItems.rootDirectoryUrl;

  const htmlFor404AndAncestorDir = String(
    readFileSync(html404AndAncestorDirFileUrl),
  );
  const fileRelativeUrl = urlToRelativeUrl(url, rootDirectoryUrl);
  const ancestorDirectoryRelativeUrl = urlToRelativeUrl(
    ancestorDirectoryUrl,
    rootDirectoryUrl,
  );
  const replacers = {
    fileUrl: directoryListingUrlMocks
      ? `@jsenv/core/${urlToRelativeUrl(url, jsenvCoreDirectoryUrl)}`
      : url,
    fileRelativeUrl,
    ancestorDirectoryUrl,
    ancestorDirectoryRelativeUrl,
    ancestorDirectoryNav: () =>
      generateDirectoryNav(ancestorDirectoryRelativeUrl, rootDirectoryUrl),
    ancestorDirectoryContent: () =>
      generateDirectoryContent(directoryContentItems),
  };
  const html = replacePlaceholders(htmlFor404AndAncestorDir, replacers);
  return html;
};
const generateDirectoryNav = (relativeUrl, rootDirectoryUrl) => {
  const rootDirectoryUrlName = urlToFilename(rootDirectoryUrl);
  const relativeUrlWithRoot = relativeUrl
    ? `${rootDirectoryUrlName}/${relativeUrl}`
    : `${rootDirectoryUrlName}/`;
  const isDir = relativeUrlWithRoot.endsWith("/");
  const parts = isDir
    ? relativeUrlWithRoot.slice(0, -1).split("/")
    : relativeUrlWithRoot.split("/");
  let dirPartsHtml = "";
  let i = 0;
  while (i < parts.length) {
    const part = parts[i];
    const href = i === 0 ? "/" : `/${parts.slice(1, i + 1).join("/")}/`;
    const text = part;
    const isLastPart = i === parts.length - 1;
    if (isLastPart) {
      dirPartsHtml += `
      <span class="directory_nav_item" data-current>
        ${text}
      </span>`;
      break;
    }
    dirPartsHtml += `
      <a class="directory_nav_item" href="${href}">
        ${text}
      </a>`;
    dirPartsHtml += `
    <span class="directory_separator">/</span>`;
    i++;
  }
  if (isDir) {
    dirPartsHtml += `
    <span class="directory_separator">/</span>`;
  }
  return dirPartsHtml;
};
const generateDirectoryContentItems = (directoryUrl, rootDirectoryUrl) => {
  let firstExistingDirectoryUrl = new URL("./", directoryUrl);
  while (!existsSync(firstExistingDirectoryUrl)) {
    firstExistingDirectoryUrl = new URL("../", firstExistingDirectoryUrl);
    if (!urlIsInsideOf(firstExistingDirectoryUrl, rootDirectoryUrl)) {
      firstExistingDirectoryUrl = new URL(rootDirectoryUrl);
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
    if (String(firstExistingDirectoryUrl) !== String(rootDirectoryUrl)) {
      break package_workspaces;
    }
    const packageDirectoryUrl = lookupPackageDirectory(rootDirectoryUrl);
    if (!packageDirectoryUrl) {
      break package_workspaces;
    }
    if (String(packageDirectoryUrl) === String(rootDirectoryUrl)) {
      break package_workspaces;
    }
    let packageContent;
    try {
      packageContent = JSON.parse(
        readFileSync(new URL("package.json", packageDirectoryUrl), "utf8"),
      );
    } catch {
      break package_workspaces;
    }
    const { workspaces } = packageContent;
    if (Array.isArray(workspaces)) {
      for (const workspace of workspaces) {
        const workspaceUrlObject = new URL(workspace, packageDirectoryUrl);
        const workspaceUrl = workspaceUrlObject.href;
        if (workspaceUrl.endsWith("*")) {
          const directoryUrl = ensurePathnameTrailingSlash(
            workspaceUrl.slice(0, -1),
          );
          fileUrls.push(new URL(directoryUrl));
        } else {
          fileUrls.push(ensurePathnameTrailingSlash(workspaceUrlObject));
        }
      }
    }
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

  const items = [];
  for (const sortedUrl of sortedUrls) {
    const fileUrlRelativeToParent = urlToRelativeUrl(
      sortedUrl,
      firstExistingDirectoryUrl,
    );
    const fileUrlRelativeToRoot = urlToRelativeUrl(sortedUrl, rootDirectoryUrl);
    const type = fileUrlRelativeToParent.endsWith("/") ? "dir" : "file";
    items.push({
      type,
      fileUrlRelativeToParent,
      fileUrlRelativeToRoot,
    });
  }
  items.rootDirectoryUrl = rootDirectoryUrl;
  items.firstExistingDirectoryUrl = firstExistingDirectoryUrl;
  return items;
};
const generateDirectoryContent = (directoryContentItems) => {
  if (directoryContentItems.length === 0) {
    return `<p>Directory is empty</p>`;
  }
  let html = `<ul class="directory_content">`;
  for (const directoryContentItem of directoryContentItems) {
    const { type, fileUrlRelativeToParent, fileUrlRelativeToRoot } =
      directoryContentItem;
    html += `
      <li class="directory_child" data-type="${type}">
        <a href="/${fileUrlRelativeToRoot}">${fileUrlRelativeToParent}</a>
      </li>`;
  }
  html += `\n  </ul>`;
  return html;
};
const replacePlaceholders = (html, replacers) => {
  return html.replace(/\$\{(\w+)\}/g, (match, name) => {
    const replacer = replacers[name];
    if (replacer === undefined) {
      return match;
    }
    if (typeof replacer === "function") {
      return replacer();
    }
    return replacer;
  });
};
