import { existsSync, readdirSync } from "node:fs";
import { createAssertionError } from "@jsenv/assert";
import { assertAndNormalizeDirectoryUrl } from "@jsenv/filesystem";

import {
  readDirectoryContent,
  writeDirectoryContent,
} from "./directory_content.js";
import { assertDirectoryContent } from "./directory_content_assertion.js";

export const takeDirectorySnapshot = (
  sourceDirectoryUrl,
  snapshotDirectoryUrl,
) => {
  sourceDirectoryUrl = assertAndNormalizeDirectoryUrl(sourceDirectoryUrl);
  snapshotDirectoryUrl = assertAndNormalizeDirectoryUrl(snapshotDirectoryUrl);
  if (
    process.env.NO_SNAPSHOT_ASSERTION ||
    !existsSync(new URL(snapshotDirectoryUrl))
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
    process.env.NO_SNAPSHOT_ASSERTION ||
    !existsSync(snapshotDirectoryUrlObject)
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
