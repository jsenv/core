import { assert, createAssertionError } from "@jsenv/assert";

export const assertDirectoryContent = (
  actualDirectoryContent,
  expectedDirectoryContent,
  sourceDirectoryUrl,
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
      if (missingFileCount === 1) {
        throw createAssertionError(
          `comparison with previous snapshot failed
--- reason ---
"${missingRelativeUrls[0]}" is missing
--- snapshot directory url ---
${snapshotDirectoryUrl}`,
        );
      }
      throw createAssertionError(
        `comparison with previous snapshot failed
--- reason ---
${missingFileCount} files are missing
--- files missing ---
${missingRelativeUrls.join("\n")}
--- snapshot directory url ---
${snapshotDirectoryUrl}`,
      );
    }
  }

  // unexpected files
  {
    const extraRelativeUrls = actualRelativeUrls.filter(
      (actualRelativeUrl) => !expectedRelativeUrls.includes(actualRelativeUrl),
    );
    const extraFileCount = extraRelativeUrls.length;
    if (extraFileCount > 0) {
      if (extraFileCount === 1) {
        throw createAssertionError(`comparison with previous snapshot failed
--- reason ---
${extraRelativeUrls[0]} file is unexpected
--- snapshot directory url ---
${snapshotDirectoryUrl}`);
      }
      throw createAssertionError(`comparison with previous snapshot failed
--- reason ---
${extraFileCount} files are unexpected
--- files unexpected ---
${extraRelativeUrls.join("\n")}
--- snapshot directory url ---
${snapshotDirectoryUrl}`);
    }
  }

  // file contents
  {
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
  }
};
