import {
  assertAndNormalizeDirectoryUrl,
  comparePathnames,
  readEntryStatSync,
} from "@jsenv/filesystem";
import { pickContentType } from "@jsenv/server";
import {
  ensurePathnameTrailingSlash,
  urlIsInsideOf,
  urlToFilename,
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
const directoryContentMagicName = "...";

export const jsenvPluginProtocolFile = ({
  magicExtensions,
  magicDirectoryIndex,
  preserveSymlinks,
  directoryListingUrlMocks,
}) => {
  return [
    jsenvPluginFsRedirection({
      directoryContentMagicName,
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
        if (reference.original) {
          const originalSpecifierPathname =
            reference.original.specifierPathname;
          if (
            originalSpecifierPathname.endsWith(`/${directoryContentMagicName}`)
          ) {
            return originalSpecifierPathname;
          }
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
        const { mainFilePath } = urlInfo.context;
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

        if (!fsStat) {
          if (request && request.headers["sec-fetch-dest"] === "document") {
            const directoryContentItems = generateDirectoryContentItems(
              urlInfo.url,
              rootDirectoryUrl,
            );
            const html = generateHtmlForENOENT(
              urlInfo.url,
              directoryContentItems,
              directoryListingUrlMocks,
              { mainFilePath },
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
            const html = generateHtmlForDirectory(directoryContentItems, {
              mainFilePath,
            });
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

const generateHtmlForDirectory = (directoryContentItems, { mainFilePath }) => {
  let directoryUrl = directoryContentItems.firstExistingDirectoryUrl;
  const rootDirectoryUrl = directoryContentItems.rootDirectoryUrl;
  directoryUrl = assertAndNormalizeDirectoryUrl(directoryUrl);

  const htmlForDirectory = String(readFileSync(htmlFileUrlForDirectory));
  const replacers = {
    directoryUrl,
    directoryNav: () =>
      generateDirectoryNav(directoryUrl, {
        rootDirectoryUrl,
        rootDirectoryUrlForServer:
          directoryContentItems.rootDirectoryUrlForServer,
        mainFilePath,
      }),
    directoryContent: () =>
      generateDirectoryContent(directoryContentItems, { mainFilePath }),
  };
  const html = replacePlaceholders(htmlForDirectory, replacers);
  return html;
};
const generateHtmlForENOENT = (
  url,
  directoryContentItems,
  directoryListingUrlMocks,
  { mainFilePath },
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
      generateDirectoryNav(ancestorDirectoryUrl, {
        rootDirectoryUrl,
        rootDirectoryUrlForServer:
          directoryContentItems.rootDirectoryUrlForServer,
        mainFilePath,
      }),
    ancestorDirectoryContent: () =>
      generateDirectoryContent(directoryContentItems, { mainFilePath }),
  };
  const html = replacePlaceholders(htmlFor404AndAncestorDir, replacers);
  return html;
};
const generateDirectoryNav = (
  entryDirectoryUrl,
  { rootDirectoryUrl, rootDirectoryUrlForServer, mainFilePath },
) => {
  const entryDirectoryRelativeUrl = urlToRelativeUrl(
    entryDirectoryUrl,
    rootDirectoryUrl,
  );
  const isDir =
    entryDirectoryRelativeUrl === "" || entryDirectoryRelativeUrl.endsWith("/");
  const rootDirectoryUrlName = urlToFilename(rootDirectoryUrl);
  const items = [];
  let dirPartsHtml = "";
  const parts = entryDirectoryRelativeUrl
    ? `${rootDirectoryUrlName}/${entryDirectoryRelativeUrl.slice(0, -1)}`.split(
        "/",
      )
    : [rootDirectoryUrlName];
  let i = 0;
  while (i < parts.length) {
    const part = parts[i];
    const directoryRelativeUrl = `${parts.slice(1, i + 1).join("/")}`;
    const directoryUrl =
      directoryRelativeUrl === ""
        ? rootDirectoryUrl
        : new URL(`${directoryRelativeUrl}/`, rootDirectoryUrl).href;
    let href =
      directoryUrl === rootDirectoryUrlForServer ||
      urlIsInsideOf(directoryUrl, rootDirectoryUrlForServer)
        ? urlToRelativeUrl(directoryUrl, rootDirectoryUrlForServer)
        : directoryUrl;
    if (href === "") {
      href = `/${directoryContentMagicName}`;
    } else {
      href = `/${href}`;
    }
    const text = part;
    items.push({
      href,
      text,
    });
    i++;
  }
  i = 0;

  const renderDirNavItem = ({ isCurrent, href, text }) => {
    const isServerRootDir = href === `/${directoryContentMagicName}`;
    if (isServerRootDir) {
      if (isCurrent) {
        return `
        <span class="directory_nav_item" data-current>
          <a class="directory_root_for_server" hot-decline href="/${mainFilePath}"></a>
          <span class="directory_name">${text}</span>
        </span>`;
      }
      return `
        <span class="directory_nav_item">
          <a class="directory_root_for_server" hot-decline href="/${mainFilePath}"></a>
          <a class="directory_name" hot-decline href="${href}">${text}</a>
        </span>`;
    }
    if (isCurrent) {
      return `
      <span class="directory_nav_item" data-current>
        <span class="directory_text">${text}</span>
      </span>`;
    }
    return `
      <span class="directory_nav_item">
        <a class="directory_text" hot-decline href="${href}">${text}</a>
      </span>`;
  };

  for (const { href, text } of items) {
    const isLastPart = i === items.length - 1;
    dirPartsHtml += renderDirNavItem({
      isCurrent: isLastPart,
      href,
      text,
    });
    if (isLastPart) {
      break;
    }
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
const generateDirectoryContentItems = (
  directoryUrl,
  rootDirectoryUrlForServer,
) => {
  let firstExistingDirectoryUrl = new URL("./", directoryUrl);
  while (!existsSync(firstExistingDirectoryUrl)) {
    firstExistingDirectoryUrl = new URL("../", firstExistingDirectoryUrl);
    if (!urlIsInsideOf(firstExistingDirectoryUrl, rootDirectoryUrlForServer)) {
      firstExistingDirectoryUrl = new URL(rootDirectoryUrlForServer);
      break;
    }
  }
  const directoryContentArray = readdirSync(firstExistingDirectoryUrl);
  const fileUrls = [];
  for (const filename of directoryContentArray) {
    const fileUrlObject = new URL(filename, firstExistingDirectoryUrl);
    fileUrls.push(fileUrlObject);
  }
  let rootDirectoryUrl = rootDirectoryUrlForServer;
  package_workspaces: {
    const packageDirectoryUrl = lookupPackageDirectory(
      rootDirectoryUrlForServer,
    );
    if (!packageDirectoryUrl) {
      break package_workspaces;
    }
    if (String(packageDirectoryUrl) === String(rootDirectoryUrlForServer)) {
      break package_workspaces;
    }
    rootDirectoryUrl = packageDirectoryUrl;
    if (
      String(firstExistingDirectoryUrl) === String(rootDirectoryUrlForServer)
    ) {
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
    const fileUrlRelativeToServer = urlToRelativeUrl(
      sortedUrl,
      rootDirectoryUrlForServer,
    );
    const type = fileUrlRelativeToParent.endsWith("/") ? "dir" : "file";
    items.push({
      type,
      fileUrlRelativeToParent,
      fileUrlRelativeToServer,
    });
  }
  items.rootDirectoryUrlForServer = rootDirectoryUrlForServer;
  items.rootDirectoryUrl = rootDirectoryUrl;
  items.firstExistingDirectoryUrl = firstExistingDirectoryUrl;
  return items;
};
const generateDirectoryContent = (directoryContentItems, { mainFilePath }) => {
  if (directoryContentItems.length === 0) {
    return `<p class="directory_empty_message">Directory is empty</p>`;
  }
  let html = `<ul class="directory_content">`;
  for (const directoryContentItem of directoryContentItems) {
    const { type, fileUrlRelativeToParent, fileUrlRelativeToServer } =
      directoryContentItem;
    let href = fileUrlRelativeToServer;
    if (href === "") {
      href = `${directoryContentMagicName}`;
    }
    const isMainFile = href === mainFilePath;
    const mainFileAttr = isMainFile ? ` data-main-file` : "";
    html += `
      <li class="directory_child" data-type="${type}"${mainFileAttr}>
        <a href="/${href}" hot-decline>${fileUrlRelativeToParent}</a>
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
