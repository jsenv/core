import { existsSync } from "node:fs";
import { assertAndNormalizeFileUrl, writeFileSync } from "@jsenv/filesystem";

import { readFileContent } from "./file_content.js";
import { assertFileContent } from "./file_content_assertion.js";

export const takeFileSnapshot = (sourceFileUrl, snapshotFileUrl) => {
  sourceFileUrl = assertAndNormalizeFileUrl(sourceFileUrl);
  snapshotFileUrl = assertAndNormalizeFileUrl(sourceFileUrl);

  if (
    process.env.NO_SNAPSHOT_ASSERTION ||
    !existsSync(new URL(snapshotFileUrl))
  ) {
    const sourceFileContent = readFileContent(sourceFileUrl);
    writeFileSync(snapshotFileUrl, sourceFileContent);
    return;
  }

  const snapshotFileContent = readFileContent(snapshotFileUrl);
  const sourceFileContent = readFileContent(sourceFileUrl);
  writeFileSync(snapshotFileUrl, sourceFileContent);
  assertFileContent(sourceFileContent, snapshotFileContent, snapshotFileUrl);
};
