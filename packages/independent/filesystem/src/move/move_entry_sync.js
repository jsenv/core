import { resolveUrl, urlToFileSystemPath } from "@jsenv/urls";
import { renameSync } from "node:fs";

import { copyEntry } from "../copy/copy_entry.js";
import { assertAndNormalizeFileUrl } from "../path_and_url/file_url_validation.js";
import { urlTargetsSameFileSystemPath } from "../path_and_url/url_targets_same_file_system_path.js";
import { ensureParentDirectoriesSync } from "../read_write/ensure_parent_directories_sync.js";
import { readSymbolicLinkSync } from "../read_write/read_symbolic_link_sync.js";
import { readEntryStatSync } from "../read_write/stat/read_entry_stat_sync.js";
import { statsToType } from "../read_write/stat/stats_to_type.js";
import { removeEntrySync } from "../remove/remove_entry_sync.js";

export const moveEntrySync = ({
  from,
  to,
  overwrite = false,
  allowUseless = false,
  followLink = true,
}) => {
  const fromUrl = assertAndNormalizeFileUrl(from);
  const fromPath = urlToFileSystemPath(fromUrl);
  let toUrl = assertAndNormalizeFileUrl(to);
  let toPath = urlToFileSystemPath(toUrl);

  const sourceStats = readEntryStatSync(fromUrl, {
    nullIfNotFound: true,
    followLink: false,
  });
  if (!sourceStats) {
    throw new Error(`nothing to move from ${fromPath}`);
  }

  let destinationStats = readEntryStatSync(toUrl, {
    nullIfNotFound: true,
    // we force false here but in fact we will follow the destination link
    // to know where we will actually move and detect useless move overrite etc..
    followLink: false,
  });

  if (followLink && destinationStats && destinationStats.isSymbolicLink()) {
    const linkTarget = readSymbolicLinkSync(toUrl);
    toUrl = resolveUrl(linkTarget, toUrl);
    toPath = urlToFileSystemPath(toUrl);
    destinationStats = readEntryStatSync(toUrl, {
      nullIfNotFound: true,
    });
  }

  if (urlTargetsSameFileSystemPath(fromUrl, toUrl)) {
    if (allowUseless) {
      return;
    }
    throw new Error(
      `no move needed for ${fromPath} because destination and source are the same`,
    );
  }

  if (destinationStats) {
    const sourceType = statsToType(sourceStats);
    const destinationType = statsToType(destinationStats);

    if (sourceType !== destinationType) {
      throw new Error(
        `cannot move ${sourceType} from ${fromPath} to ${toPath} because destination exists and is not a ${sourceType} (it's a ${destinationType})`,
      );
    }
    if (!overwrite) {
      throw new Error(
        `cannot move ${sourceType} from ${fromPath} to ${toPath} because destination exists and overwrite option is disabled`,
      );
    }

    // remove file, link, directory...
    removeEntrySync(toUrl, {
      recursive: true,
    });
  } else {
    ensureParentDirectoriesSync(toUrl);
  }

  moveNaiveSync(fromPath, toPath, {
    handleCrossDeviceError: () => {
      copyEntry({
        from: fromUrl,
        to: toUrl,
        preserveStat: true,
      });
      removeEntrySync(fromUrl, {
        recursive: true,
      });
    },
  });
};

const moveNaiveSync = (
  fromPath,
  destinationPath,
  { handleCrossDeviceError = null } = {},
) => {
  try {
    renameSync(fromPath, destinationPath);
  } catch (error) {
    if (error) {
      if (handleCrossDeviceError && error.code === "EXDEV") {
        handleCrossDeviceError(error);
      } else {
        throw error;
      }
    }
  }
};
