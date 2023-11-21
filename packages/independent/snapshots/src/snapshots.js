import { readFileSync, existsSync } from "node:fs";
import {
  assertAndNormalizeDirectoryUrl,
  writeFileSync,
} from "@jsenv/filesystem";
import { assert } from "@jsenv/assert";

export const takeFileSnapshot = (fileUrl, snapshotFileUrl) => {
  const fileContent = readFileSync(fileUrl, "utf8");
  const snapshotFileContent = readFileSync(snapshotFileUrl, "utf8");
  writeFileSync(snapshotFileUrl, fileContent);
  assertSnapshots({
    actual: fileContent,
    expected: snapshotFileContent,
    snapshotUrl: snapshotFileUrl,
  });
};
