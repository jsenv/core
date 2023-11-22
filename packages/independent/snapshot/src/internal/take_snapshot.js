import { readFileSync, readdirSync, statSync } from "node:fs";
import {
  assertAndNormalizeDirectoryUrl,
  assertAndNormalizeFileUrl,
  comparePathnames,
} from "@jsenv/filesystem";
import { urlToRelativeUrl } from "@jsenv/urls";
import { CONTENT_TYPE } from "@jsenv/utils/src/content_type/content_type.js";

export const takeDirectorySnapshot = (directoryUrl) => {
  directoryUrl = assertAndNormalizeDirectoryUrl(directoryUrl);
  directoryUrl = new URL(directoryUrl);

  const snapshotNaturalOrder = {};
  const visitDirectory = (url) => {
    try {
      const directoryContent = readdirSync(url);
      directoryContent.forEach((filename) => {
        const contentUrl = new URL(filename, url);
        const stat = statSync(contentUrl);
        if (stat.isDirectory()) {
          visitDirectory(new URL(`${contentUrl}/`));
        } else {
          const relativeUrl = urlToRelativeUrl(contentUrl, directoryUrl);
          snapshotNaturalOrder[relativeUrl] = takeFileSnapshot(contentUrl);
        }
      });
    } catch (e) {
      if (e && e.code === "ENOENT") {
        return;
      }
      throw e;
    }
  };
  visitDirectory(directoryUrl);
  const snapshot = {};
  const relativeUrls = Object.keys(snapshotNaturalOrder);
  relativeUrls.sort(comparePathnames);
  relativeUrls.forEach((relativeUrl) => {
    snapshot[relativeUrl] = snapshotNaturalOrder[relativeUrl];
  });
  return snapshot;
};

export const takeFileSnapshot = (fileUrl) => {
  fileUrl = assertAndNormalizeFileUrl(fileUrl);

  const isTextual = CONTENT_TYPE.isTextual(
    CONTENT_TYPE.fromUrlExtension(fileUrl),
  );
  if (isTextual) {
    const content = readFileSync(fileUrl, "utf8");
    if (process.platform === "win32") {
      // ensure unix line breaks
      return content.replace(/\r\n/g, "\n");
    }
    return content;
  }
  const content = readFileSync(fileUrl);
  return content;
};
