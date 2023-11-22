import { existsSync, readdirSync } from "node:fs";
import { createAssertionError } from "@jsenv/assert";
import { assertAndNormalizeDirectoryUrl } from "@jsenv/filesystem";

import {
  readDirectoryContent,
  writeDirectoryContent,
} from "./directory_content.js";
import { assertFileContent } from "./file_content_assertion.js";

export const takeDirectorySnapshot = (
  sourceDirectoryUrl,
  snapshotDirectoryUrl,
) => {
  sourceDirectoryUrl = assertAndNormalizeDirectoryUrl(sourceDirectoryUrl);
  snapshotDirectoryUrl = assertAndNormalizeDirectoryUrl(snapshotDirectoryUrl);

  if (
    !existsSync(new URL(snapshotDirectoryUrl)) ||
    readdirSync(new URL(snapshotDirectoryUrl)).length === 0
  ) {
    // just update the snapshot directory content
    const sourceDirectoryContent = readDirectoryContent(sourceDirectoryUrl);
    writeDirectoryContent(snapshotDirectoryUrl, sourceDirectoryContent);
    return;
  }
  const snapshotDirectoryContent = readDirectoryContent(snapshotDirectoryUrl);
  const sourceDirectoryContent = readDirectoryContent(sourceDirectoryUrl);
  writeDirectoryContent(snapshotDirectoryUrl, sourceDirectoryContent);
  assertDirectoryContent(
    sourceDirectoryContent,
    snapshotDirectoryContent,
    snapshotDirectoryUrl,
  );
};

export const assertSnapshotDirectoryTakenByFunction = async (
  snapshotDirectoryUrl,
  callback,
) => {
  snapshotDirectoryUrl = assertAndNormalizeDirectoryUrl(snapshotDirectoryUrl);
  const snapshotDirectoryUrlObject = new URL(snapshotDirectoryUrl);
  if (
    !existsSync(snapshotDirectoryUrlObject) ||
    readdirSync(new URL(snapshotDirectoryUrl)).length === 0
  ) {
    // just call the callback and ensure it has written something
    await callback();
    if (!existsSync(snapshotDirectoryUrlObject)) {
      throw createAssertionError(
        `function was expected to write file(s) in ${snapshotDirectoryUrl}`,
      );
    }
    const snapshotContent = readdirSync(snapshotDirectoryUrlObject);
    if (snapshotContent.length === 0) {
      throw createAssertionError(
        `function was expected to write file(s) in ${snapshotDirectoryUrl}`,
      );
    }
    return;
  }
  const snapshotDirectoryContentBeforeCall =
    readDirectoryContent(snapshotDirectoryUrl);
  await callback();
  const snapshotDirectoryContentAfterCall =
    readDirectoryContent(snapshotDirectoryUrl);
  assertDirectoryContent(
    snapshotDirectoryContentAfterCall,
    snapshotDirectoryContentBeforeCall,
    snapshotDirectoryUrl,
  );
};

const assertDirectoryContent = (
  actualDirectoryContent,
  expectedDirectoryContent,
  snapshotDirectoryUrl,
) => {
  const actualRelativeUrls = Object.keys(actualDirectoryContent);
  const expectedRelativeUrls = Object.keys(expectedDirectoryContent);

  // missing_files
  {
    const missingRelativeUrls = expectedRelativeUrls.filter(
      (expectedRelativeUrl) =>
        !actualRelativeUrls.includes(expectedRelativeUrl),
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
    const extraRelativeUrls = actualRelativeUrls.filter(
      (actualRelativeUrl) => !expectedRelativeUrls.includes(actualRelativeUrl),
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
    for (const relativeUrl of Object.keys(actualDirectoryContent)) {
      const actualContent = actualDirectoryContent[relativeUrl];
      const expectedContent = expectedDirectoryContent[relativeUrl];
      assertFileContent(
        actualContent,
        expectedContent,
        `${snapshotDirectoryUrl}${relativeUrl}`,
      );
    }
  }
};
