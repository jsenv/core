import { urlToFileSystemPath } from "@jsenv/urls";

import { assertAndNormalizeFileUrl } from "../path_and_url/file_url_validation.js";
import { readEntryStat } from "../read_write/stat/read_entry_stat.js";
import { statsToType } from "../read_write/stat/stats_to_type.js";
import { writeDirectory } from "../read_write/write_directory.js";
import { removeEntry } from "./remove_entry.js";

export const ensureEmptyDirectory = async (source) => {
  const stats = await readEntryStat(source, {
    nullIfNotFound: true,
    followLink: false,
  });
  if (stats === null) {
    // if there is nothing, create a directory
    await writeDirectory(source, { allowUseless: true });
    return;
  }
  if (stats.isDirectory()) {
    // if there is a directory remove its content and done
    await removeEntry(source, {
      allowUseless: true,
      recursive: true,
      onlyContent: true,
    });
    return;
  }

  const sourceType = statsToType(stats);
  const sourcePath = urlToFileSystemPath(assertAndNormalizeFileUrl(source));
  throw new Error(
    `ensureEmptyDirectory expect directory at ${sourcePath}, found ${sourceType} instead`,
  );
};
