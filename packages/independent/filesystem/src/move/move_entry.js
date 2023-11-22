import { rename } from "node:fs";
import { Abort } from "@jsenv/abort";
import { urlToFileSystemPath, resolveUrl } from "@jsenv/urls";

import { assertAndNormalizeFileUrl } from "../path_and_url/file_url_validation.js";
import { urlTargetsSameFileSystemPath } from "../path_and_url/url_targets_same_file_system_path.js";
import { statsToType } from "../stat/stats_to_type.js";
import { readEntryStat } from "../stat/read_entry_stat.js";
import { ensureParentDirectories } from "../content/ensure_parent_directories.js";
import { readSymbolicLink } from "../content/read_symbolic_link.js";
import { copyEntry } from "../copy/copy_entry.js";
import { removeEntry } from "../remove/remove_entry.js";

export const moveEntry = async ({
  signal = new AbortController().signal,
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

  const sourceStats = await readEntryStat(fromUrl, {
    nullIfNotFound: true,
    followLink: false,
  });
  if (!sourceStats) {
    throw new Error(`nothing to move from ${fromPath}`);
  }

  let destinationStats = await readEntryStat(toUrl, {
    nullIfNotFound: true,
    // we force false here but in fact we will follow the destination link
    // to know where we will actually move and detect useless move overrite etc..
    followLink: false,
  });

  if (followLink && destinationStats && destinationStats.isSymbolicLink()) {
    const linkTarget = await readSymbolicLink(toUrl);
    toUrl = resolveUrl(linkTarget, toUrl);
    toPath = urlToFileSystemPath(toUrl);
    destinationStats = await readEntryStat(toUrl, {
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

  const moveOperation = Abort.startOperation();
  moveOperation.addAbortSignal(signal);

  try {
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
      await removeEntry(toUrl, {
        signal: moveOperation.signal,
        recursive: true,
      });
    } else {
      await ensureParentDirectories(toUrl);
    }

    moveOperation.throwIfAborted();
    await moveNaive(fromPath, toPath, {
      handleCrossDeviceError: async () => {
        await copyEntry({
          from: fromUrl,
          to: toUrl,
          preserveStat: true,
        });
        await removeEntry(fromUrl, {
          signal: moveOperation.signal,
          recursive: true,
        });
      },
    });
  } finally {
    await moveOperation.end();
  }
};

const moveNaive = (
  fromPath,
  destinationPath,
  { handleCrossDeviceError = null } = {},
) => {
  return new Promise((resolve, reject) => {
    rename(fromPath, destinationPath, (error) => {
      if (error) {
        if (handleCrossDeviceError && error.code === "EXDEV") {
          resolve(handleCrossDeviceError(error));
        } else {
          reject(error);
        }
      } else {
        resolve();
      }
    });
  });
};
