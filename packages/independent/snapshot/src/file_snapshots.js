import { readdirSync, statSync, readFileSync } from "node:fs";
import {
  assertAndNormalizeDirectoryUrl,
  assertAndNormalizeFileUrl,
  comparePathnames,
  ensureEmptyDirectorySync,
  removeFileSync,
  writeFileSync,
  removeDirectorySync,
  writeFileStructureSync,
} from "@jsenv/filesystem";
import { urlToFilename, urlToRelativeUrl } from "@jsenv/urls";
import { URL_META } from "@jsenv/url-meta";
import { CONTENT_TYPE } from "@jsenv/utils/src/content_type/content_type.js";

import { assert } from "@jsenv/assert";
import {
  FileContentNotFoundAssertionError,
  FileMissingAssertionError,
  ExtraFileAssertionError,
  FileContentAssertionError,
} from "./errors.js";
import { comparePngFiles } from "./compare_png_files.js";

export const takeFileSnapshot = (fileUrl) => {
  fileUrl = assertAndNormalizeFileUrl(fileUrl);
  const expectedFileSnapshot = createFileSnapshot(fileUrl);
  removeFileSync(fileUrl, { allowUseless: true });

  return {
    compare: () => {
      compareFileSnapshots(createFileSnapshot(fileUrl), expectedFileSnapshot);
    },
    writeContent: (content) => {
      writeFileSync(fileUrl, content);
    },
    restore: () => {
      if (expectedFileSnapshot.empty) {
        removeFileSync(fileUrl, { allowUseless: true });
        return;
      }
      writeFileSync(fileUrl, expectedFileSnapshot.content);
    },
  };
};
const createFileSnapshot = (fileUrl) => {
  const fileSnapshot = {
    type: "file",
    url: fileUrl,
    stat: null,
    contentType: CONTENT_TYPE.fromUrlExtension(fileUrl),
    content: "",
  };

  try {
    fileSnapshot.stat = statSync(new URL(fileUrl));
  } catch (e) {
    if (e.code === "ENOENT") {
      return fileSnapshot;
    }
    throw e;
  }
  if (!fileSnapshot.stat.isFile()) {
    throw new Error(`file expect at ${fileUrl}`);
  }

  const isTextual = CONTENT_TYPE.isTextual(fileSnapshot.contentType);
  if (isTextual) {
    const contentAsString = readFileSync(new URL(fileUrl), "utf8");
    if (process.platform === "win32") {
      // ensure unix line breaks
      fileSnapshot.content = contentAsString.replace(/\r\n/g, "\n");
    } else {
      fileSnapshot.content = contentAsString;
    }
  } else {
    const contentAsBuffer = readFileSync(new URL(fileUrl));
    if (contentAsBuffer.length === 0) {
      fileSnapshot.content = "";
    } else {
      fileSnapshot.content = contentAsBuffer;
    }
  }
  return fileSnapshot;
};
const compareFileSnapshots = (actualFileSnapshot, expectedFileSnapshot) => {
  const fileUrl = actualFileSnapshot.url;
  const filename = urlToFilename(fileUrl);
  const failureMessage = `snapshot comparison failed for "${filename}"`;

  if (!actualFileSnapshot.stat) {
    const fileNotFoundAssertionError =
      new FileContentNotFoundAssertionError(`${failureMessage}
--- reason ---
file not found
--- file ---
${fileUrl}`);
    throw fileNotFoundAssertionError;
  }
  if (!expectedFileSnapshot.stat) {
    return;
  }
  const actualFileContent = actualFileSnapshot.content;
  const expectedFileContent = expectedFileSnapshot.content;
  if (Buffer.isBuffer(actualFileContent)) {
    if (actualFileContent.equals(expectedFileContent)) {
      return;
    }
    if (actualFileSnapshot.contentType === "image/png") {
      if (comparePngFiles(actualFileContent, expectedFileContent)) {
        return;
      }
    }
    const fileContentAssertionError =
      new FileContentAssertionError(`${failureMessage}
--- reason ---
content has changed
--- file ---
${fileUrl}`);
    throw fileContentAssertionError;
  }
  if (actualFileContent === expectedFileContent) {
    return;
  }
  assert({
    message: failureMessage,
    details: fileUrl,
    actual: actualFileContent,
    expect: expectedFileContent,
    forceMultilineDiff: true,
  });
};

export const takeDirectorySnapshot = (directoryUrl, pattern) => {
  directoryUrl = assertAndNormalizeDirectoryUrl(directoryUrl);
  const includePredicate = pattern
    ? (() => {
        const associations = URL_META.resolveAssociations(
          {
            include: {
              "**/.*": false,
              "**/.*/": false,
              "**/node_modules/": false,
              ...pattern,
            },
          },
          directoryUrl,
        );
        return (url) => {
          const meta = URL_META.applyAssociations({
            url,
            associations,
          });
          return meta.include;
        };
      })()
    : () => true;

  directoryUrl = new URL(directoryUrl);

  const expectedDirectorySnapshot = createDirectorySnapshot(
    directoryUrl,
    includePredicate,
  );
  ensureEmptyDirectorySync(directoryUrl);
  return {
    compare: () => {
      const dirname = `${urlToFilename(directoryUrl)}/`;
      const failureMessage = `snapshot comparison failed for "${dirname}"`;
      const actualDirectorySnapshot = createDirectorySnapshot(
        directoryUrl,
        includePredicate,
      );
      if (!expectedDirectorySnapshot.stat || expectedDirectorySnapshot.empty) {
        // the snapshot taken for directory/file/whatever is empty:
        // - first time code executes:
        //   it defines snapshot that will be used for comparison by future runs
        // - snapshot have been cleaned:
        //   we want to re-generated all snapshots without failing tests
        //   (happens when we know beforehand snapshot will change and we just want
        //   to review them using git diff)
        return;
      }

      const actualFileSnapshots = actualDirectorySnapshot.fileSnapshots;
      const expectedFileSnapshots = expectedDirectorySnapshot.fileSnapshots;
      const actualRelativeUrls = Object.keys(actualFileSnapshots);
      const expectedRelativeUrls = Object.keys(expectedFileSnapshots);

      // missing_files
      {
        const missingRelativeUrls = expectedRelativeUrls.filter(
          (expectedRelativeUrl) =>
            !actualRelativeUrls.includes(expectedRelativeUrl),
        );
        const missingFileCount = missingRelativeUrls.length;
        if (missingFileCount > 0) {
          const missingUrls = missingRelativeUrls.map(
            (relativeUrl) => new URL(relativeUrl, directoryUrl).href,
          );
          if (missingFileCount === 1) {
            const fileMissingAssertionError =
              new FileMissingAssertionError(`${failureMessage}
--- reason ---
"${missingRelativeUrls[0]}" is missing
--- file missing ---
${missingUrls[0]}`);

            throw fileMissingAssertionError;
          }
          const fileMissingAssertionError =
            new FileMissingAssertionError(`${failureMessage}
--- reason ---
${missingFileCount} files are missing
--- files missing ---
${missingUrls.join("\n")}`);
          throw fileMissingAssertionError;
        }
      }

      // unexpected files
      {
        const extraRelativeUrls = actualRelativeUrls.filter(
          (actualRelativeUrl) =>
            !expectedRelativeUrls.includes(actualRelativeUrl),
        );
        const extraFileCount = extraRelativeUrls.length;
        if (extraFileCount > 0) {
          const extraUrls = extraRelativeUrls.map(
            (relativeUrl) => new URL(relativeUrl, directoryUrl).href,
          );
          if (extraFileCount === 1) {
            const extraFileAssertionError =
              new ExtraFileAssertionError(`${failureMessage}
--- reason ---
"${extraRelativeUrls[0]}" is unexpected
--- file unexpected ---
${extraUrls[0]}`);
            throw extraFileAssertionError;
          }
          const extraFileAssertionError =
            new ExtraFileAssertionError(`${failureMessage}
--- reason ---
${extraFileCount} files are unexpected
--- files unexpected ---
${extraUrls.join("\n")}`);
          throw extraFileAssertionError;
        }
      }

      // file contents
      {
        for (const relativeUrl of actualRelativeUrls) {
          const actualFileSnapshot = actualFileSnapshots[relativeUrl];
          const expectedFileSnapshot = expectedFileSnapshots[relativeUrl];
          compareFileSnapshots(actualFileSnapshot, expectedFileSnapshot);
        }
      }
    },
    addFile: (relativeUrl, content) => {
      writeFileSync(new URL(relativeUrl, directoryUrl), content);
    },
    restore: () => {
      if (expectedDirectorySnapshot.notFound) {
        removeDirectorySync(directoryUrl, {
          recursive: true,
          allowUseless: true,
        });
        return;
      }
      if (expectedDirectorySnapshot.empty) {
        ensureEmptyDirectorySync(directoryUrl);
        return;
      }

      const fileStructure = {};
      Object.keys(expectedDirectorySnapshot.fileSnapshots).forEach(
        (relativeUrl) => {
          const fileSnapshot =
            expectedDirectorySnapshot.fileSnapshots[relativeUrl];
          if (!fileSnapshot.empty) {
            fileStructure[relativeUrl] = fileSnapshot.content;
          }
        },
      );
      writeFileStructureSync(
        directoryUrl,
        expectedDirectorySnapshot.fileStructure,
      );
    },
  };
};
const createDirectorySnapshot = (directoryUrl, includePredicate) => {
  const directorySnapshot = {
    type: "directory",
    url: directoryUrl.href,
    stat: null,
    empty: false,
    fileSnapshots: {},
  };

  try {
    directorySnapshot.stat = statSync(directoryUrl);
  } catch (e) {
    if (e.code === "ENOENT") {
      return directorySnapshot;
    }
    if (e.code === "ENOTDIR") {
      // trailing slash is forced on directoryUrl
      // as a result Node.js throw ENOTDIR when doing "stat" operation
      throw new Error(`directory expect at ${directoryUrl}`);
    }
    throw e;
  }
  if (!directorySnapshot.stat.isDirectory()) {
    throw new Error(`directory expect at ${directoryUrl}`);
  }

  const entryNames = readdirSync(directoryUrl);
  if (entryNames.length === 0) {
    directorySnapshot.empty = true;
    return directorySnapshot;
  }

  const fileSnapshotsNaturalOrder = {};
  const visitDirectory = (url) => {
    if (!includePredicate(url)) {
      return;
    }
    try {
      const directoryContent = readdirSync(url);
      for (const filename of directoryContent) {
        const contentUrl = new URL(filename, url);
        const stat = statSync(contentUrl);
        if (stat.isDirectory()) {
          visitDirectory(new URL(`${contentUrl}/`));
          return;
        }
        if (!includePredicate(contentUrl)) {
          return;
        }
        const relativeUrl = urlToRelativeUrl(contentUrl, directoryUrl);
        fileSnapshotsNaturalOrder[relativeUrl] = createFileSnapshot(contentUrl);
      }
    } catch (e) {
      if (e && e.code === "ENOENT") {
        return;
      }
      throw e;
    }
  };
  visitDirectory(directoryUrl);

  const relativeUrls = Object.keys(fileSnapshotsNaturalOrder);
  relativeUrls.sort(comparePathnames);
  relativeUrls.forEach((relativeUrl) => {
    directorySnapshot.fileSnapshots[relativeUrl] =
      fileSnapshotsNaturalOrder[relativeUrl];
  });
  return directorySnapshot;
};
