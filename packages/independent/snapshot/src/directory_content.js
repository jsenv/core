import { readdirSync, statSync, rmSync } from "node:fs";
import {
  assertAndNormalizeDirectoryUrl,
  writeFileSync,
  comparePathnames,
} from "@jsenv/filesystem";
import { urlToRelativeUrl } from "@jsenv/urls";

import { readFileContent } from "./file_content.js";

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
          const relativeUrl = urlToRelativeUrl(contentUrl, directoryUrl);
          fileContents[relativeUrl] = readFileContent(contentUrl);
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
