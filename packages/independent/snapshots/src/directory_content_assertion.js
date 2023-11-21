import { createAssertionError } from "@jsenv/assert";
import { formatStringAssertionErrorMessage } from "@jsenv/assert/src/internal/error_message/strings.js";

export const assertDirectoryContent = (
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
      if (actualContent === expectedContent) {
        continue;
      }
      if (Buffer.isBuffer(actualContent)) {
        // TODO
      }
      const message = formatStringAssertionErrorMessage({
        actual: actualContent,
        expected: expectedContent,
        name: "file content",
      });
      throw createAssertionError(`comparison with previous snapshot failed
--- reason ---
"${relativeUrl}": ${message}
--- file ---
${snapshotDirectoryUrl}${relativeUrl}`);
    }
  }
};
