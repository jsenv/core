import { urlToFileSystemPath } from "@jsenv/urls";

import { assertAndNormalizeFileUrl } from "./file_url_validation.js";
import { statsToType } from "./internal/statsToType.js";
import { readEntryStat } from "./read_entry_stat.js";

export const assertDirectoryPresence = async (source) => {
  const sourceUrl = assertAndNormalizeFileUrl(source);
  const sourcePath = urlToFileSystemPath(sourceUrl);

  const sourceStats = await readEntryStat(sourceUrl, {
    nullIfNotFound: true,
  });
  if (!sourceStats) {
    throw new Error(`directory not found at ${sourcePath}`);
  }
  if (!sourceStats.isDirectory()) {
    throw new Error(
      `directory expected at ${sourcePath} and found ${statsToType(
        sourceStats,
      )} instead`,
    );
  }
};
