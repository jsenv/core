import { promises } from "node:fs";
import { urlToFileSystemPath } from "@jsenv/urls";

import { assertAndNormalizeDirectoryUrl } from "../path_and_url/directory_url_validation.js";
import { statsToType } from "./stat/stats_to_type.js";
import { readEntryStat } from "./stat/read_entry_stat.js";

// https://nodejs.org/dist/latest-v13.x/docs/api/fs.html#fs_fspromises_mkdir_path_options
const { mkdir } = promises;

export const writeDirectory = async (
  destination,
  { recursive = true, allowUseless = false } = {},
) => {
  const destinationUrl = assertAndNormalizeDirectoryUrl(destination);
  const destinationPath = urlToFileSystemPath(destinationUrl);

  const destinationStats = await readEntryStat(destinationUrl, {
    nullIfNotFound: true,
    followLink: false,
  });

  if (destinationStats) {
    if (destinationStats.isDirectory()) {
      if (allowUseless) {
        return;
      }
      throw new Error(`directory already exists at ${destinationPath}`);
    }

    const destinationType = statsToType(destinationStats);
    throw new Error(
      `cannot write directory at ${destinationPath} because there is a ${destinationType}`,
    );
  }

  try {
    await mkdir(destinationPath, { recursive });
  } catch (error) {
    if (allowUseless && error.code === "EEXIST") {
      return;
    }
    throw error;
  }
};
