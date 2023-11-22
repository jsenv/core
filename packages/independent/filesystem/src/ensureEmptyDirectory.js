import { urlToFileSystemPath } from "@jsenv/urls";

import { assertAndNormalizeFileUrl } from "./file_url_validation.js";
import { statsToType } from "./internal/statsToType.js";
import { writeDirectory } from "./writeDirectory.js";
import { readEntryStat } from "./read_entry_stat.js";
import { removeEntry } from "./remove_entry.js";

export const ensureEmptyDirectory = async (source) => {
  const stats = await readEntryStat(source, {
    nullIfNotFound: true,
    followLink: false,
  });
  if (stats === null) {
    // if there is nothing, create a directory
    return writeDirectory(source, { allowUseless: true });
  }
  if (stats.isDirectory()) {
    // if there is a directory remove its content and done
    return removeEntry(source, {
      allowUseless: true,
      recursive: true,
      onlyContent: true,
    });
  }

  const sourceType = statsToType(stats);
  const sourcePath = urlToFileSystemPath(assertAndNormalizeFileUrl(source));
  throw new Error(
    `ensureEmptyDirectory expect directory at ${sourcePath}, found ${sourceType} instead`,
  );
};
