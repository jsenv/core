import { existsSync, readdirSync, statSync } from "node:fs";
import {
  assertAndNormalizeDirectoryUrl,
  assertAndNormalizeFileUrl,
} from "@jsenv/filesystem";
import { urlToFilename } from "@jsenv/urls";
import {
  createAssertionError,
  formatStringAssertionErrorMessage,
} from "@jsenv/assert";

import { takeDirectorySnapshot, takeFileSnapshot } from "./take_snapshot.js";
import { saveSnapshotOnFileSystem } from "./save_snapshot.js";

export const takeDirectorySnapshotAndCompare = (
  sourceDirectoryUrl,
  snapshotDirectoryUrl,
) => {
  sourceDirectoryUrl = assertAndNormalizeDirectoryUrl(sourceDirectoryUrl);
  snapshotDirectoryUrl = assertAndNormalizeDirectoryUrl(snapshotDirectoryUrl);

  if (
    !existsSync(new URL(snapshotDirectoryUrl)) ||
    readdirSync(new URL(snapshotDirectoryUrl)).length === 0
  ) {
    const currentDirectorySnapshot = takeDirectorySnapshot(sourceDirectoryUrl);
    saveSnapshotOnFileSystem(currentDirectorySnapshot, snapshotDirectoryUrl);
    return;
  }
  const previousDirectorySnapshot = takeDirectorySnapshot(snapshotDirectoryUrl);
  const currentDirectorySnapshot = takeDirectorySnapshot(sourceDirectoryUrl);
  saveSnapshotOnFileSystem(currentDirectorySnapshot, snapshotDirectoryUrl);
  compareDirectorySnapshots(
    currentDirectorySnapshot,
    previousDirectorySnapshot,
    snapshotDirectoryUrl,
  );
};

export const takeFileSnapshotAndCompare = (sourceFileUrl, snapshotFileUrl) => {
  sourceFileUrl = assertAndNormalizeFileUrl(sourceFileUrl);
  snapshotFileUrl = assertAndNormalizeFileUrl(sourceFileUrl);

  if (!existsSync(new URL(snapshotFileUrl))) {
    const sourceFileContent = takeFileSnapshot(sourceFileUrl);
    saveSnapshotOnFileSystem(sourceFileContent, snapshotFileUrl);
    return;
  }
  const previousFileContent = takeFileSnapshot(snapshotFileUrl);
  const currentFileContent = takeFileSnapshot(sourceFileUrl);
  saveSnapshotOnFileSystem(currentFileContent, snapshotFileUrl);
  compareFileSnapshots(
    currentFileContent,
    previousFileContent,
    snapshotFileUrl,
  );
};

export const compareSnapshotTakenByFunction = async (snapshotUrl, callback) => {
  snapshotUrl = assertAndNormalizeFileUrl(snapshotUrl);
  const snapshotUrlObject = new URL(snapshotUrl);

  const exists = existsSync(snapshotUrlObject);
  const isDirectory = exists && statSync(snapshotUrlObject).isDirectory();
  const hasSnapshotBeforeCall = isDirectory
    ? exists && readdirSync(snapshotUrlObject).length > 0
    : exists;

  if (!hasSnapshotBeforeCall) {
    // just call the callback and ensure it has written something
    await callback();
    if (isDirectory) {
      const hasSnapshotAfterCall =
        existsSync(snapshotUrlObject) &&
        readdirSync(snapshotUrlObject).length > 0;
      if (!hasSnapshotAfterCall) {
        throw createAssertionError(
          `function was expected to write file at ${snapshotUrl}`,
        );
      }
    }
    const hasSnapshotAfterCall = existsSync(snapshotUrlObject);
    if (!hasSnapshotAfterCall) {
      throw createAssertionError(
        `function was expected to write file at ${snapshotUrl}`,
      );
    }
    return;
  }

  const snapshotBeforeCall = isDirectory
    ? takeDirectorySnapshot(snapshotUrl)
    : takeFileSnapshot(snapshotUrl);
  await callback();
  const snapshotAfterCall = isDirectory
    ? takeDirectorySnapshot(snapshotUrl)
    : takeFileSnapshot(snapshotUrl);

  if (isDirectory) {
    compareDirectorySnapshots(
      snapshotAfterCall,
      snapshotBeforeCall,
      snapshotUrl,
    );
  } else {
    compareFileSnapshots(snapshotAfterCall, snapshotBeforeCall, snapshotUrl);
  }
};

const compareDirectorySnapshots = (
  currentDirectorySnapshot,
  previousDirectorySnapshot,
  snapshotDirectoryUrl,
) => {
  const currentRelativeUrls = Object.keys(currentDirectorySnapshot);
  const previousRelativeUrls = Object.keys(previousDirectorySnapshot);

  // missing_files
  {
    const missingRelativeUrls = previousRelativeUrls.filter(
      (previousRelativeUrl) =>
        !currentRelativeUrls.includes(previousRelativeUrl),
    );
    const missingFileCount = missingRelativeUrls.length;
    if (missingFileCount > 0) {
      const missingUrls = missingRelativeUrls.map(
        (relativeUrl) => new URL(relativeUrl, snapshotDirectoryUrl).href,
      );
      if (missingFileCount === 1) {
        throw createAssertionError(
          `comparison with previous snapshot failed
--- reason ---
"${missingRelativeUrls[0]}" is missing
--- file missing ---
${missingUrls[0]}`,
        );
      }
      throw createAssertionError(`comparison with previous snapshot failed
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
        (relativeUrl) => new URL(relativeUrl, snapshotDirectoryUrl).href,
      );
      if (extraFileCount === 1) {
        throw createAssertionError(`comparison with previous snapshot failed
--- reason ---
"${extraRelativeUrls[0]}" is unexpected
--- file unexpected ---
${extraUrls[0]}`);
      }
      throw createAssertionError(`comparison with previous snapshot failed
--- reason ---
${extraFileCount} files are unexpected
--- files unexpected ---
${extraUrls.join("\n")}`);
    }
  }

  // file contents
  {
    for (const relativeUrl of currentRelativeUrls) {
      const currentFileSnapshot = currentDirectorySnapshot[relativeUrl];
      const previousFileSnapshot = previousDirectorySnapshot[relativeUrl];
      compareFileSnapshots(
        currentFileSnapshot,
        previousFileSnapshot,
        `${snapshotDirectoryUrl}${relativeUrl}`,
      );
    }
  }
};

const compareFileSnapshots = (
  currentFileSnapshot,
  previousFileSnapshot,
  snapshotFileUrl,
) => {
  if (Buffer.isBuffer(currentFileSnapshot)) {
    if (currentFileSnapshot.equals(previousFileSnapshot)) {
      return;
    }
    throw createAssertionError(`comparison with previous snapshot failed
--- reason ---
"${urlToFilename(snapshotFileUrl)}" content is unequal
--- file ---
${snapshotFileUrl}`);
  }
  if (currentFileSnapshot === previousFileSnapshot) {
    return;
  }
  const message = formatStringAssertionErrorMessage({
    actual: currentFileSnapshot,
    expected: previousFileSnapshot,
    name: `"${urlToFilename(snapshotFileUrl)}" content`,
  });
  throw createAssertionError(`comparison with previous snapshot failed
--- reason ---
${message}
--- file ---
${snapshotFileUrl}`);
};
