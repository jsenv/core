import { urlToFileSystemPath } from "@jsenv/urls";

import { assertAndNormalizeFileUrl } from "./path_and_url/file_url_validation.js";
import { readEntryStat } from "./read_write/stat/read_entry_stat.js";
import { statsToType } from "./read_write/stat/stats_to_type.js";

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
