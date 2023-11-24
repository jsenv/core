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
import { CONTENT_TYPE } from "@jsenv/utils/src/content_type/content_type.js";

import {
  createAssertionError,
  formatStringAssertionErrorMessage,
} from "@jsenv/assert";

const snapshotSymbol = Symbol.for("snapshot");

export const takeDirectorySnapshot = (directoryUrl) => {
  directoryUrl = assertAndNormalizeDirectoryUrl(directoryUrl);
  directoryUrl = new URL(directoryUrl);

  const expectedDirectorySnapshot = createDirectorySnapshot(directoryUrl);
  ensureEmptyDirectorySync(directoryUrl);
  return {
    compare: () => {
      const actualDirectorySnapshot = createDirectorySnapshot(directoryUrl);
      compareSnapshots(actualDirectorySnapshot, expectedDirectorySnapshot);
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
      writeFileStructureSync(
        directoryUrl,
        expectedDirectorySnapshot.fileStructure,
      );
    },
  };
};
const createDirectorySnapshot = (directoryUrl) => {
  const directorySnapshot = {
    [snapshotSymbol]: true,
    empty: false,
    type: "directory",
    url: directoryUrl.href,
    notFound: false,
    fileStructure: {},
  };

  let stat;
  try {
    stat = statSync(directoryUrl);
    if (!stat.isDirectory()) {
      throw new Error(`directory expected at ${directoryUrl}`);
    }
    const entryNames = readdirSync(directoryUrl);
    if (entryNames.length === 0) {
      directorySnapshot.empty = true;
      return directorySnapshot;
    }
  } catch (e) {
    if (e.code === "ENOENT") {
      directorySnapshot.empty = true;
      directorySnapshot.notFound = true;
      return directorySnapshot;
    }
  }

  const snapshotNaturalOrder = {};
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
        snapshotNaturalOrder[relativeUrl] = takeFileSnapshot(contentUrl);
      });
    } catch (e) {
      if (e && e.code === "ENOENT") {
        return;
      }
      throw e;
    }
  };
  visitDirectory(directoryUrl);

  const relativeUrls = Object.keys(snapshotNaturalOrder);
  relativeUrls.sort(comparePathnames);
  relativeUrls.forEach((relativeUrl) => {
    directorySnapshot.fileStructure[relativeUrl] =
      snapshotNaturalOrder[relativeUrl];
  });
  return directorySnapshot;
};

export const takeFileSnapshot = (fileUrl) => {
  fileUrl = assertAndNormalizeFileUrl(fileUrl);
  const expectedFileSnapshot = createFileSnapshot(fileUrl);
  removeFileSync(fileUrl);
  return {
    compare: () => {
      const actualFileSnapshot = createFileSnapshot(fileUrl);
      compareSnapshots(actualFileSnapshot, expectedFileSnapshot);
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
    [snapshotSymbol]: true,
    empty: false,
    type: "file",
    url: fileUrl,
    content: "",
  };

  let stat;
  try {
    stat = statSync(new URL(fileUrl));
  } catch (e) {
    if (e.code === "ENOENT") {
      fileSnapshot.empty = true;
      return fileSnapshot;
    }
  }
  if (!stat.isFile()) {
    throw new Error(`file expected at ${fileUrl}`);
  }

  const isTextual = CONTENT_TYPE.isTextual(
    CONTENT_TYPE.fromUrlExtension(fileUrl),
  );
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

const compareSnapshots = (currentSnapshot, previousSnapshot) => {
  if (!currentSnapshot || !currentSnapshot[snapshotSymbol]) {
    throw new TypeError(
      `1st argument must be a snapshot, received ${currentSnapshot}`,
    );
  }
  if (!previousSnapshot || !previousSnapshot[snapshotSymbol]) {
    throw new TypeError(
      `2nd argument must be a snapshot, received ${previousSnapshot}`,
    );
  }

  const currentShapsnotType = currentSnapshot.type;
  const previousSnapshotType = previousSnapshot.type;
  if (currentShapsnotType !== previousSnapshotType) {
    throw new TypeError(
      `cannot compare snapshots of different types "${currentShapsnotType}" vs "${previousSnapshotType}"`,
    );
  }
  const comparer = snapshotComparers[currentShapsnotType];
  if (!comparer) {
    throw new TypeError(`Unknow snapshot type "${currentShapsnotType}"`);
  }
  if (previousSnapshot.empty) {
    // the snapshot taken for directory/file/whatever is empty:
    // - first time code executes:
    //   it defines snapshot that will be used for comparison by future runs
    // - snapshot have been cleaned:
    //   we want to re-generated all snapshots without failing tests
    //   (happens when we know beforehand snapshot will change and we just want
    //   to review them using git diff)
    return;
  }
  comparer(currentSnapshot, previousSnapshot);
};

const snapshotComparers = {
  directory: (currentDirectorySnapshot, previousDirectorySnapshot) => {
    const failureMessage = `comparison with previous directory snapshot failed`;
    const currentFileStructure = currentDirectorySnapshot.fileStructure;
    const previousFileStructure = previousDirectorySnapshot.fileStructure;
    const currentRelativeUrls = Object.keys(currentFileStructure);
    const previousRelativeUrls = Object.keys(previousFileStructure);

    // missing_files
    {
      const missingRelativeUrls = previousRelativeUrls.filter(
        (previousRelativeUrl) =>
          !currentRelativeUrls.includes(previousRelativeUrl),
      );
      const missingFileCount = missingRelativeUrls.length;
      if (missingFileCount > 0) {
        const missingUrls = missingRelativeUrls.map(
          (relativeUrl) =>
            new URL(relativeUrl, currentDirectorySnapshot.url).href,
        );
        if (missingFileCount === 1) {
          throw createAssertionError(`${failureMessage}
--- reason ---
"${missingRelativeUrls[0]}" is missing
--- file missing ---
${missingUrls[0]}`);
        }
        throw createAssertionError(`${failureMessage}
--- reason ---
${missingFileCount} files are missing
--- files missing ---
${missingUrls.join("\n")}`);
      }
    }

    // unexpected files
    {
      const extraRelativeUrls = currentRelativeUrls.filter(
        (currentRelativeUrl) =>
          !previousRelativeUrls.includes(currentRelativeUrl),
      );
      const extraFileCount = extraRelativeUrls.length;
      if (extraFileCount > 0) {
        const extraUrls = extraRelativeUrls.map(
          (relativeUrl) =>
            new URL(relativeUrl, currentDirectorySnapshot.url).href,
        );
        if (extraFileCount === 1) {
          throw createAssertionError(`${failureMessage}
--- reason ---
"${extraRelativeUrls[0]}" is unexpected
--- file unexpected ---
${extraUrls[0]}`);
        }
        throw createAssertionError(`${failureMessage}
--- reason ---
${extraFileCount} files are unexpected
--- files unexpected ---
${extraUrls.join("\n")}`);
      }
    }

    // file contents
    {
      for (const relativeUrl of currentRelativeUrls) {
        const currentFileSnapshot = currentFileStructure[relativeUrl];
        const previousFileSnapshot = previousFileStructure[relativeUrl];
        compareSnapshots(currentFileSnapshot, previousFileSnapshot);
      }
    }
  },
  file: (currentFileSnapshot, previousFileSnapshot) => {
    const failureMessage = `comparison with previous file snapshot failed`;
    const currentFileContent = currentFileSnapshot.content;
    const previousFileContent = previousFileSnapshot.content;
    if (Buffer.isBuffer(currentFileContent)) {
      if (currentFileContent.equals(previousFileContent)) {
        return;
      }
      throw createAssertionError(`${failureMessage}
--- reason ---
"${urlToFilename(currentFileSnapshot.url)}" content has changed
--- file ---
${currentFileSnapshot.url}`);
    }
    if (currentFileContent === previousFileContent) {
      return;
    }
    const message = formatStringAssertionErrorMessage({
      actual: currentFileContent,
      expected: previousFileContent,
      name: `"${urlToFilename(currentFileSnapshot.url)}" content`,
    });
    throw createAssertionError(`${failureMessage}
--- reason ---
${message}
--- file ---
${currentFileSnapshot.url}`);
  },
};
