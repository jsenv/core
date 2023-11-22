import { urlToFilename } from "@jsenv/urls";
import { createAssertionError } from "@jsenv/assert";
import { formatStringAssertionErrorMessage } from "@jsenv/assert/src/internal/error_message/strings.js";

export const assertFileContent = (
  actualFileContent,
  expectedFileContent,
  snapshotFileUrl,
) => {
  if (Buffer.isBuffer(actualFileContent)) {
    if (actualFileContent.equals(expectedFileContent)) {
      return;
    }
    throw createAssertionError(`comparison with previous snapshot failed
--- reason ---
"${urlToFilename(snapshotFileUrl)}" content is unequal
--- file ---
${snapshotFileUrl}`);
  }
  if (actualFileContent === expectedFileContent) {
    return;
  }
  const message = formatStringAssertionErrorMessage({
    actual: actualFileContent,
    expected: expectedFileContent,
    name: `"${urlToFilename(snapshotFileUrl)}" content`,
  });
  throw createAssertionError(`comparison with previous snapshot failed
--- reason ---
${message}
--- file ---
${snapshotFileUrl}`);
};
