import { readdirSync, statSync, readFileSync } from "node:fs";
import { URL_META } from "@jsenv/url-meta";
import {
  assertAndNormalizeDirectoryUrl,
  assertAndNormalizeFileUrl,
  comparePathnames,
  ensureEmptyDirectorySync,
  removeFileSync,
  writeFileSync,
  removeDirectorySync,
} from "@jsenv/filesystem";
import { CONTENT_TYPE } from "@jsenv/utils/src/content_type/content_type.js";
import { urlToRelativeUrl, urlToFilename } from "@jsenv/urls";

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
  const fileSnapshot = createFileSnapshot(fileUrl);
  removeFileSync(fileUrl, { allowUseless: true });
  return {
    compare: (doIt = process.env.CI) => {
      if (!doIt) {
        return;
      }
      fileSnapshot.compare(createFileSnapshot(fileUrl));
    },
    writeContent: (content) => {
      writeFileSync(fileUrl, content);
    },
    restore: () => {
      if (fileSnapshot.empty) {
        removeFileSync(fileUrl, { allowUseless: true });
        return;
      }
      writeFileSync(fileUrl, fileSnapshot.content);
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
    compare: (nextFileSnapshot) => {
      const filename = urlToFilename(fileUrl);
      const failureMessage = `snapshot comparison failed for "${filename}"`;

      if (!nextFileSnapshot.stat) {
        const fileNotFoundAssertionError =
          new FileContentNotFoundAssertionError(`${failureMessage}
--- reason ---
file not found
--- file ---
${fileUrl}`);
        throw fileNotFoundAssertionError;
      }
      if (!fileSnapshot.stat) {
        return;
      }
      const fileContent = fileSnapshot.content;
      const nextFileContent = nextFileSnapshot.content;
      if (Buffer.isBuffer(nextFileContent)) {
        if (nextFileContent.equals(fileContent)) {
          return;
        }
        if (fileSnapshot.contentType === "image/png") {
          if (comparePngFiles(fileContent, nextFileContent)) {
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
      if (nextFileContent === fileContent) {
        return;
      }
      assert({
        message: failureMessage,
        actual: nextFileContent,
        expect: fileContent,
        details: fileUrl,
        forceMultilineDiff: true,
      });
    },
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

export const takeDirectorySnapshot = (
  directoryUrl,
  pattern = { "**/*": true },
) => {
  directoryUrl = assertAndNormalizeDirectoryUrl(directoryUrl);
  directoryUrl = new URL(directoryUrl);
  const associations = URL_META.resolveAssociations(
    {
      included: pattern,
    },
    directoryUrl,
  );
  const predicate = ({ included }) => included;
  const shouldVisitDirectory = (url) =>
    URL_META.urlChildMayMatch({
      url,
      associations,
      predicate,
    });
  const shouldIncludeFile = (url) =>
    predicate(
      URL_META.applyAssociations({
        url,
        associations,
      }),
    );
  const directorySnapshot = createDirectorySnapshot(directoryUrl, {
    shouldVisitDirectory,
    shouldIncludeFile,
    clean: true,
  });
  return {
    __snapshot: directorySnapshot,
    compare: (doIt = process.env.CI) => {
      if (!doIt) {
        return;
      }
      const nextDirectorySnapshot = createDirectorySnapshot(directoryUrl, {
        shouldVisitDirectory,
        shouldIncludeFile,
      });
      directorySnapshot.compare(nextDirectorySnapshot);
    },
    addFile: (relativeUrl, content) => {
      writeFileSync(new URL(relativeUrl, directoryUrl), content);
    },
    restore: () => {
      if (directorySnapshot.notFound) {
        removeDirectorySync(directoryUrl, {
          recursive: true,
          allowUseless: true,
        });
        return;
      }
      if (directorySnapshot.empty) {
        ensureEmptyDirectorySync(directoryUrl);
        return;
      }
      for (const relativeUrl of directorySnapshot.contentSnapshot) {
        const snapshot = directorySnapshot.contentSnapshot[relativeUrl];
        snapshot.restore();
      }
    },
  };
};
const createDirectorySnapshot = (
  directoryUrl,
  { shouldVisitDirectory, shouldIncludeFile, clean },
) => {
  const directorySnapshot = {
    type: "directory",
    url: directoryUrl.href,
    stat: null,
    empty: false,
    contentSnapshot: {},
    compare: (nextDirectorySnapshot) => {
      const dirname = `${urlToFilename(directoryUrl)}/`;
      const failureMessage = `snapshot comparison failed for "${dirname}"`;
      if (!directorySnapshot.stat || directorySnapshot.empty) {
        // the snapshot taken for directory/file/whatever is empty:
        // - first time code executes:
        //   it defines snapshot that will be used for comparison by future runs
        // - snapshot have been cleaned:
        //   we want to re-generated all snapshots without failing tests
        //   (happens when we know beforehand snapshot will change and we just want
        //   to review them using git diff)
        return;
      }
      const directoryContentSnapshot = directorySnapshot.contentSnapshot;
      const relativeUrls = Object.keys(directoryContentSnapshot);
      const nextDirectoryContentSnapshot =
        nextDirectorySnapshot.contentSnapshot;
      const nextRelativeUrls = Object.keys(nextDirectoryContentSnapshot);
      // missing content
      {
        const missingRelativeUrls = relativeUrls.filter(
          (relativeUrl) => !nextRelativeUrls.includes(relativeUrl),
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
"${missingRelativeUrls[0]}" directory entry is missing
--- missing entry ---
${missingUrls[0]}`);
            throw fileMissingAssertionError;
          }
          const fileMissingAssertionError =
            new FileMissingAssertionError(`${failureMessage}
--- reason ---
${missingFileCount} directory entries are missing
--- missing entries ---
${missingUrls.join("\n")}`);
          throw fileMissingAssertionError;
        }
      }
      // unexpected content
      {
        const extraRelativeUrls = nextRelativeUrls.filter(
          (nextRelativeUrl) => !relativeUrls.includes(nextRelativeUrl),
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
"${extraRelativeUrls[0]}" directory entry is unexpected
--- unexpected entry ---
${extraUrls[0]}`);
            throw extraFileAssertionError;
          }
          const extraFileAssertionError =
            new ExtraFileAssertionError(`${failureMessage}
--- reason ---
${extraFileCount} directory entries are unexpected
--- unexpected entries ---
${extraUrls.join("\n")}`);
          throw extraFileAssertionError;
        }
      }
      // content
      {
        for (const relativeUrl of nextRelativeUrls) {
          const snapshot = directoryContentSnapshot[relativeUrl];
          const nextSnapshot = nextDirectoryContentSnapshot[relativeUrl];
          snapshot.compare(nextSnapshot);
        }
      }
    },
  };
  try {
    directorySnapshot.stat = statSync(new URL(directoryUrl));
  } catch (e) {
    if (e.code === "ENOENT") {
      return directorySnapshot;
    }
    if (e.code === "ENOTDIR") {
      // trailing slash is forced on directoryUrl
      // as a result Node.js throw ENOTDIR when doing "stat" operation
      throw new Error(`directory expected at ${directoryUrl}`);
    }
    throw e;
  }
  if (!directorySnapshot.stat.isDirectory()) {
    throw new Error(`directory expected at ${directoryUrl}`);
  }
  const entryNames = readdirSync(directoryUrl);
  if (entryNames.length === 0) {
    directorySnapshot.empty = true;
    return directorySnapshot;
  }
  const contentSnapshotNaturalOrder = {};
  try {
    const directoryItemArray = readdirSync(directoryUrl);
    for (const directoryItem of directoryItemArray) {
      const directoryItemUrl = new URL(directoryItem, directoryUrl);
      let directoryItemStat;
      try {
        directoryItemStat = statSync(directoryItemUrl);
      } catch (e) {
        if (e.code === "ENOENT") {
          continue;
        }
        throw e;
      }
      const relativeUrl = urlToRelativeUrl(directoryItemUrl, directoryUrl);
      if (directoryItemStat.isDirectory()) {
        if (!shouldVisitDirectory(directoryUrl)) {
          continue;
        }
        contentSnapshotNaturalOrder[relativeUrl] = createDirectorySnapshot(
          new URL(`${directoryItemUrl}/`),
          {
            shouldVisitDirectory,
            shouldIncludeFile,
            clean,
          },
        );
        continue;
      }
      if (!shouldIncludeFile(directoryItemUrl)) {
        continue;
      }
      contentSnapshotNaturalOrder[relativeUrl] =
        createFileSnapshot(directoryItemUrl);
      if (clean) {
        removeFileSync(directoryItemUrl, { allowUseless: true });
      }
    }
  } catch (e) {
    if (e && e.code === "ENOENT") {
    } else {
      throw e;
    }
  }
  const relativeUrls = Object.keys(contentSnapshotNaturalOrder);
  relativeUrls.sort(comparePathnames);
  relativeUrls.forEach((relativeUrl) => {
    directorySnapshot.contentSnapshot[relativeUrl] =
      contentSnapshotNaturalOrder[relativeUrl];
  });
  return directorySnapshot;
};
