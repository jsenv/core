import { readdirSync, statSync, readFileSync } from "node:fs";
import { urlToRelativeUrl } from "@jsenv/urls";
import { CONTENT_TYPE } from "@jsenv/utils/src/content_type/content_type.js";

import { comparePathnames } from "../path_and_url/compare_pathnames.js";

export const readFileStructureSync = (directoryUrl) => {
  const fileStructure = {};
  const fileStructureNotOrdered = {};
  const visitDirectory = (url) => {
    try {
      const directoryContent = readdirSync(url);
      directoryContent.forEach((filename) => {
        const contentUrl = new URL(filename, url);
        const stat = statSync(contentUrl);
        if (stat.isDirectory()) {
          visitDirectory(new URL(`${contentUrl}/`));
          return;
        }
        const relativeUrl = urlToRelativeUrl(contentUrl, directoryUrl);
        fileStructureNotOrdered[relativeUrl] = readFileContent(contentUrl);
      });
    } catch (e) {
      if (e && e.code === "ENOENT") {
        return;
      }
      throw e;
    }
  };
  visitDirectory(new URL(directoryUrl));

  const relativeUrls = Object.keys(fileStructureNotOrdered);
  relativeUrls.sort(comparePathnames);
  relativeUrls.forEach((relativeUrl) => {
    fileStructure[relativeUrl] = fileStructureNotOrdered[relativeUrl];
  });
  return fileStructure;
};

const readFileContent = (fileUrl) => {
  const isTextual = CONTENT_TYPE.isTextual(
    CONTENT_TYPE.fromUrlExtension(fileUrl),
  );
  if (isTextual) {
    const content = readFileSync(new URL(fileUrl), "utf8");
    if (process.platform === "win32") {
      // ensure unix line breaks
      return content.replace(/\r\n/g, "\n");
    }
    return content;
  }
  const content = readFileSync(new URL(fileUrl));
  if (content.length === 0) {
    return "";
  }
  return content;
};
