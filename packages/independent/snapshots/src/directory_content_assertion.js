import { assert } from "@jsenv/assert";

export const assertDirectoryContent = (
  actualDirectoryContent,
  expectedDirectoryContent,
  sourceDirectoryUrl,
  snapshotDirectoryUrl,
) => {
  if (process.env.NO_SNAPSHOT_ASSERTION) {
    return;
  }
  const actualFiles = Object.keys(actualDirectoryContent).map(
    (relativeUrl) => new URL(relativeUrl, sourceDirectoryUrl).href,
  );
  const expectedFiles = Object.keys(expectedDirectoryContent).map(
    (relativeUrl) => new URL(relativeUrl, sourceDirectoryUrl).href,
  );
  assert({ actual: actualFiles, expected: expectedFiles });
  for (const relativeUrl of Object.keys(actualDirectoryContent)) {
    const actualContent = actualDirectoryContent[relativeUrl];
    const expectedContent = expectedDirectoryContent[relativeUrl];
    const sourceFileUrl = new URL(relativeUrl, sourceDirectoryUrl).href;
    const snapshotFileUrl = new URL(relativeUrl, snapshotDirectoryUrl).href;

    assert({
      actual: actualContent,
      expected: expectedContent,
      details: {
        "reason": "file content does not match snapshot",
        "file": sourceFileUrl,
        "snapshot url": snapshotFileUrl,
      },
    });
  }
};
