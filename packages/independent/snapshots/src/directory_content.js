import { readdirSync, statSync, readFileSync, rmSync } from "node:fs";
import {
  assertAndNormalizeDirectoryUrl,
  writeFileSync,
  comparePathnames,
} from "@jsenv/filesystem";
import { urlToRelativeUrl } from "@jsenv/urls";
import { CONTENT_TYPE } from "@jsenv/utils/src/content_type/content_type.js";

import { ensureUnixLineBreaks } from "./line_break_unix.js";

export const readDirectoryContent = (directoryUrl) => {
  directoryUrl = assertAndNormalizeDirectoryUrl(directoryUrl);
  directoryUrl = new URL(directoryUrl);

  const fileContents = {};
  const visitDirectory = (url) => {
    try {
      const directoryContent = readdirSync(url);
      directoryContent.forEach((filename) => {
        const contentUrl = new URL(filename, url);
        const stat = statSync(contentUrl);
        if (stat.isDirectory()) {
          visitDirectory(new URL(`${contentUrl}/`));
        } else {
          const isTextual = CONTENT_TYPE.isTextual(
            CONTENT_TYPE.fromUrlExtension(contentUrl),
          );
          const content = readFileSync(contentUrl, isTextual ? "utf8" : null);
          const relativeUrl = urlToRelativeUrl(contentUrl, directoryUrl);
          fileContents[relativeUrl] =
            isTextual && process.platform === "win32"
              ? ensureUnixLineBreaks(content)
              : content;
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
  const sortedFileContents = {};
  Object.keys(fileContents)
    .sort(comparePathnames)
    .forEach((relativeUrl) => {
      sortedFileContents[relativeUrl] = fileContents[relativeUrl];
    });
  return sortedFileContents;
};

export const writeDirectoryContent = (directoryUrl, fileContents) => {
  try {
    rmSync(new URL(directoryUrl), {
      recursive: true,
      force: true,
    });
  } catch (e) {
    if (!e || e.code !== "ENOENT") {
      throw e;
    }
  }
  Object.keys(fileContents).forEach((relativeUrl) => {
    const contentUrl = new URL(relativeUrl, directoryUrl);
    const content = fileContents[relativeUrl];
    writeFileSync(contentUrl, content);
  });
};
