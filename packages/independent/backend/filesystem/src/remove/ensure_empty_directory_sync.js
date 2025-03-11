import { urlToFileSystemPath } from "@jsenv/urls";

import { assertAndNormalizeFileUrl } from "../path_and_url/file_url_validation.js";
import { readEntryStatSync } from "../read_write/stat/read_entry_stat_sync.js";
import { statsToType } from "../read_write/stat/stats_to_type.js";
import { writeDirectorySync } from "../read_write/write_directory_sync.js";
import { removeEntrySync } from "./remove_entry_sync.js";

export const ensureEmptyDirectorySync = (source) => {
  const stat = readEntryStatSync(source, {
    nullIfNotFound: true,
    followLink: false,
  });

  if (stat === null) {
    // if there is nothing, create a directory
    writeDirectorySync(source, { allowUseless: true });
    return;
  }
  if (stat.isDirectory()) {
    removeEntrySync(source, {
      recursive: true,
      onlyContent: true,
      allowUseless: true,
    });
    return;
  }

  const sourceType = statsToType(stat);
  const sourcePath = urlToFileSystemPath(assertAndNormalizeFileUrl(source));
  throw new Error(
    `ensureEmptyDirectorySync expect directory at ${sourcePath}, found ${sourceType} instead`,
  );
};
