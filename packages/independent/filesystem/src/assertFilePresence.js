import { urlToFileSystemPath } from "@jsenv/urls";

import { assertAndNormalizeFileUrl } from "./file_url_validation.js";
import { statsToType } from "./internal/statsToType.js";
import { readEntryStat } from "./readEntryStat.js";

export const assertFilePresence = async (source) => {
  const sourceUrl = assertAndNormalizeFileUrl(source);
  const sourcePath = urlToFileSystemPath(sourceUrl);

  const sourceStats = await readEntryStat(sourceUrl, {
    nullIfNotFound: true,
  });
  if (!sourceStats) {
    throw new Error(`file not found at ${sourcePath}`);
  }
  if (!sourceStats.isFile()) {
    throw new Error(
      `file expected at ${sourcePath} and found ${statsToType(
        sourceStats,
      )} instead`,
    );
  }
};
