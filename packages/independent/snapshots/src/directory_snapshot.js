import { existsSync } from "node:fs";
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
    sourceDirectoryUrl,
    snapshotDirectoryUrl,
  );
};

export const assertSnapshotDirectoryTakenByFunction = async (
  snapshotDirectoryUrl,
  callback,
) => {
  if (
    process.env.NO_SNAPSHOT_ASSERTION ||
    !existsSync(new URL(snapshotDirectoryUrl))
  ) {
    // just call the callback and ensure it has written something
    await callback();
    // TODO here: assert something was written
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
    snapshotDirectoryUrl,
  );
};
