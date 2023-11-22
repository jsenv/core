import {
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  rmSync,
} from "node:fs";
import { urlToRelativeUrl } from "@jsenv/urls";
import { CONTENT_TYPE } from "@jsenv/utils/src/content_type/content_type.js";

import { assertAndNormalizeDirectoryUrl } from "./directory_url_validation.js";
import { comparePathnames } from "./comparePathnames.js";

export const readFileStructureSync = (directoryUrl) => {
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
          fileContents[relativeUrl] = readFileContentSync(contentUrl);
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
export const writeFileStructureSync = (directoryUrl, fileContents) => {
  directoryUrl = assertAndNormalizeDirectoryUrl(directoryUrl);

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

const readFileContentSync = (fileUrl) => {
  const isTextual = CONTENT_TYPE.isTextual(
    CONTENT_TYPE.fromUrlExtension(fileUrl),
  );
  const content = readFileSync(fileUrl, isTextual ? "utf8" : null);

  return isTextual && process.platform === "win32"
    ? ensureUnixLineBreaks(content)
    : content;
};
const ensureUnixLineBreaks = (stringOrBuffer) => {
  if (typeof stringOrBuffer === "string") {
    const stringWithLinuxBreaks = stringOrBuffer.replace(/\r\n/g, "\n");
    return stringWithLinuxBreaks;
  }
  return ensureUnixLineBreaksOnBuffer(stringOrBuffer);
};
// https://github.com/nodejs/help/issues/1738#issuecomment-458460503
const ensureUnixLineBreaksOnBuffer = (buffer) => {
  const int32Array = new Int32Array(buffer, 0, buffer.length);
  const int32ArrayWithLineBreaksNormalized = int32Array.filter(
    (element, index, typedArray) => {
      if (element === 0x0d) {
        if (typedArray[index + 1] === 0x0a) {
          // Windows -> Unix
          return false;
        }
        // Mac OS -> Unix
        typedArray[index] = 0x0a;
      }
      return true;
    },
  );
  return Buffer.from(int32ArrayWithLineBreaksNormalized);
};
