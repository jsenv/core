import {
  assertAndNormalizeDirectoryUrl,
  comparePathnames,
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
import { jsenvCoreDirectoryUrl } from "../../jsenv_core_directory_url.js";
import { jsenvPluginFsRedirection } from "./jsenv_plugin_fs_redirection.js";

const html404AndParentDirFileUrl = new URL(
  "./client/html_404_and_parent_dir.html",
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
        const urlObject = new URL(urlInfo.url);
        const { firstReference } = urlInfo;
        if (firstReference.leadsToADirectory) {
          const directoryContentArray = readdirSync(urlObject);
          if (firstReference.type === "filesystem") {
            const content = JSON.stringify(directoryContentArray, null, "  ");
            return {
              type: "directory",
              contentType: "application/json",
              content,
            };
          }
          const acceptsHtml = urlInfo.context.request
            ? pickContentType(urlInfo.context.request, ["text/html"])
            : false;
          if (acceptsHtml) {
            firstReference.expectedType = "html";
            const html = generateHtmlForDirectory(
              urlObject.href,
              directoryContentArray,
              urlInfo.context.rootDirectoryUrl,
            );
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
        const contentType = CONTENT_TYPE.fromUrlExtension(urlInfo.url);
        const request = urlInfo.context.request;
        if (request && request.headers["sec-fetch-dest"] === "document") {
          try {
            const fileBuffer = readFileSync(urlObject);
            const content = String(fileBuffer);
            return {
              content,
              contentType,
              contentLength: fileBuffer.length,
            };
          } catch (e) {
            if (e.code !== "ENOENT") {
              throw e;
            }
            const parentDirectoryUrl = new URL("./", urlInfo.url);
            if (!existsSync(parentDirectoryUrl)) {
              throw e;
            }
            const parentDirectoryContentArray = readdirSync(
              new URL(parentDirectoryUrl),
            );
            const html = generateHtmlForENOENT(
              urlInfo.url,
              parentDirectoryContentArray,
              parentDirectoryUrl,
              urlInfo.context.rootDirectoryUrl,
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
        const fileBuffer = readFileSync(urlObject);
        const content = CONTENT_TYPE.isTextual(contentType)
          ? String(fileBuffer)
          : fileBuffer;
        return {
          content,
          contentType,
          contentLength: fileBuffer.length,
        };
      },
    },
  ];
};

const generateHtmlForDirectory = (
  directoryUrl,
  directoryContentArray,
  rootDirectoryUrl,
) => {
  directoryUrl = assertAndNormalizeDirectoryUrl(directoryUrl);

  const htmlForDirectory = String(readFileSync(htmlFileUrlForDirectory));
  const directoryRelativeUrl = urlToRelativeUrl(directoryUrl, rootDirectoryUrl);
  const replacers = {
    directoryUrl,
    directoryNav: () =>
      generateDirectoryNav(directoryRelativeUrl, rootDirectoryUrl),
    directoryContent: () =>
      generateDirectoryContent(
        directoryContentArray,
        directoryUrl,
        rootDirectoryUrl,
      ),
  };
  const html = replacePlaceholders(htmlForDirectory, replacers);
  return html;
};
const generateHtmlForENOENT = (
  url,
  parentDirectoryContentArray,
  parentDirectoryUrl,
  rootDirectoryUrl,
  directoryListingUrlMocks,
) => {
  const htmlFor404AndParentDir = String(
    readFileSync(html404AndParentDirFileUrl),
  );
  const fileRelativeUrl = urlToRelativeUrl(url, rootDirectoryUrl);
  const parentDirectoryRelativeUrl = urlToRelativeUrl(
    parentDirectoryUrl,
    rootDirectoryUrl,
  );
  const replacers = {
    fileUrl: directoryListingUrlMocks
      ? `@jsenv/core/${urlToRelativeUrl(url, jsenvCoreDirectoryUrl)}`
      : url,
    fileRelativeUrl,
    parentDirectoryUrl,
    parentDirectoryRelativeUrl,
    parentDirectoryNav: () =>
      generateDirectoryNav(parentDirectoryRelativeUrl, rootDirectoryUrl),
    parentDirectoryContent: () =>
      generateDirectoryContent(
        parentDirectoryContentArray,
        parentDirectoryUrl,
        rootDirectoryUrl,
      ),
  };
  const html = replacePlaceholders(htmlFor404AndParentDir, replacers);
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
const generateDirectoryContent = (
  directoryContentArray,
  directoryUrl,
  rootDirectoryUrl,
) => {
  if (directoryContentArray.length === 0) {
    return `<p>Directory is empty</p>`;
  }
  const sortedNames = [];
  for (const filename of directoryContentArray) {
    const fileUrlObject = new URL(filename, directoryUrl);
    if (lstatSync(fileUrlObject).isDirectory()) {
      sortedNames.push(`${filename}/`);
    } else {
      sortedNames.push(filename);
    }
  }
  sortedNames.sort(comparePathnames);
  let html = `<ul class="directory_content">`;
  for (const filename of sortedNames) {
    const fileUrlObject = new URL(filename, directoryUrl);
    const fileUrl = String(fileUrlObject);
    const fileUrlRelativeToParent = urlToRelativeUrl(fileUrl, directoryUrl);
    const fileUrlRelativeToRoot = urlToRelativeUrl(fileUrl, rootDirectoryUrl);
    const type = fileUrlRelativeToParent.endsWith("/") ? "dir" : "file";
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
