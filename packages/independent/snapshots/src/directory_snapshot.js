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

  if (!existsSync(new URL(snapshotDirectoryUrl))) {
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

export const assertSnapshotDirectoryAfterCallback = async (
  snapshotDirectoryUrl,
  callback,
) => {
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
