import { ensureWindowsDriveLetter } from "@jsenv/filesystem";
import { moveUrl, setUrlFilename, urlIsInsideOf } from "@jsenv/urls";

export const determineFileUrlForOutDirectory = (
  url,
  { filenameHint, rootDirectoryUrl, outDirectoryUrl },
) => {
  if (!outDirectoryUrl) {
    return url;
  }
  if (url.startsWith("file:")) {
    if (!urlIsInsideOf(url, rootDirectoryUrl)) {
      const fsRootUrl = ensureWindowsDriveLetter("file:///", url);
      url = `${rootDirectoryUrl}@fs/${url.slice(fsRootUrl.length)}`;
    }
    if (filenameHint) {
      url = setUrlFilename(url, filenameHint);
    }
    return moveUrl({
      url,
      from: rootDirectoryUrl,
      to: outDirectoryUrl,
    });
  }
  if (url.startsWith("http:") || url.startsWith("https:")) {
    const urlObject = new URL(url);
    const { host, pathname, search } = urlObject;
    let fileUrl = String(outDirectoryUrl);
    if (url.startsWith("http:")) {
      fileUrl += "@http/";
    } else {
      fileUrl += "@https/";
    }
    fileUrl += asValidFilename(host);
    if (pathname) {
      fileUrl += "/";
      fileUrl += asValidFilename(pathname);
    }
    if (search) {
      fileUrl += search;
    }
    return fileUrl;
  }
  return url;
};

// see https://github.com/parshap/node-sanitize-filename/blob/master/index.js
const asValidFilename = (string) => {
  string = string.trim().toLowerCase();
  if (string === ".") return "_";
  if (string === "..") return "__";
  string = string.replace(/[ ,]/g, "_").replace(/["/?<>\\:*|]/g, "");
  return string;
};
