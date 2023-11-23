import { mkdirSync } from "node:fs";
import { urlToFileSystemPath } from "@jsenv/urls";

import { assertAndNormalizeDirectoryUrl } from "../path_and_url/directory_url_validation.js";
import { readEntryStatSync } from "./stat/read_entry_stat_sync.js";
import { statsToType } from "./stat/stats_to_type.js";

export const writeDirectorySync = (
  destination,
  { recursive = true, allowUseless = false } = {},
) => {
  const destinationUrl = assertAndNormalizeDirectoryUrl(destination);
  const destinationPath = urlToFileSystemPath(destinationUrl);

  const destinationStats = readEntryStatSync(destinationUrl, {
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
    mkdirSync(destinationPath, { recursive });
  } catch (error) {
    if (allowUseless && error.code === "EEXIST") {
      return;
    }
    throw error;
  }
};
