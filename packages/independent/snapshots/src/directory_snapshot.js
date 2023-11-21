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
  snapshotDirectoryUrl = assertAndNormalizeDirectoryUrl(snapshotDirectoryUrl);
  snapshotDirectoryUrl = new URL(snapshotDirectoryUrl);
  if (!existsSync(snapshotDirectoryUrl)) {
    const sourceDirectoryContent = readDirectoryContent(sourceDirectoryUrl);
    writeDirectoryContent(snapshotDirectoryUrl, sourceDirectoryContent);
    return;
  }
  const snapshotDirectoryContent = readDirectoryContent(snapshotDirectoryUrl);
  const sourceDirectoryContent = readDirectoryContent(sourceDirectoryUrl);
  writeDirectoryContent(snapshotDirectoryUrl, sourceDirectoryContent);
  assertDirectoryContent(sourceDirectoryContent, snapshotDirectoryContent);
};

export const assertSnapshotDirectoryAfterCallback = async (
  snapshotDirectoryUrl,
  callback,
) => {
  snapshotDirectoryUrl = assertAndNormalizeDirectoryUrl(snapshotDirectoryUrl);
  snapshotDirectoryUrl = new URL(snapshotDirectoryUrl);
  const snapshotDirectoryContentBeforeCall =
    readDirectoryContent(snapshotDirectoryUrl);
  await callback();
  const snapshotDirectoryContentAfterCall =
    readDirectoryContent(snapshotDirectoryUrl);
  assertDirectoryContent(
    snapshotDirectoryContentAfterCall,
    snapshotDirectoryContentBeforeCall,
  );
};
