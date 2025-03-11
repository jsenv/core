import { Abort } from "@jsenv/abort";
import { resolveUrl, urlToFileSystemPath } from "@jsenv/urls";

import { assertAndNormalizeDirectoryUrl } from "../path_and_url/directory_url_validation.js";
import { urlTargetsSameFileSystemPath } from "../path_and_url/url_targets_same_file_system_path.js";
import { readDirectory } from "../read_write/read_directory.js";
import { readSymbolicLink } from "../read_write/read_symbolic_link.js";
import { readEntryStat } from "../read_write/stat/read_entry_stat.js";
import { statsToType } from "../read_write/stat/stats_to_type.js";
import { copyEntry } from "./copy_entry.js";

export const copyDirectoryContent = async ({
  signal = new AbortController().signal,
  from,
  to,
  overwrite,
  followLink = true,
} = {}) => {
  const fromUrl = assertAndNormalizeDirectoryUrl(from);
  const fromPath = urlToFileSystemPath(fromUrl);
  let toUrl = assertAndNormalizeDirectoryUrl(to);
  let toPath = urlToFileSystemPath(toUrl);

  const sourceStats = await readEntryStat(fromUrl, {
    nullIfNotFound: true,
    followLink: false,
  });
  if (!sourceStats) {
    throw new Error(`no directory to copy content from at ${fromPath}`);
  }
  if (!sourceStats.isDirectory()) {
    const sourceType = statsToType(sourceStats);
    throw new Error(
      `found a ${sourceType} instead of a directory at ${fromPath}`,
    );
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

  if (destinationStats === null) {
    throw new Error(`no directory to copy content into at ${toPath}`);
  }
  if (!destinationStats.isDirectory()) {
    const destinationType = statsToType(destinationStats);
    throw new Error(
      `destination leads to a ${destinationType} instead of a directory at ${toPath}`,
    );
  }

  if (urlTargetsSameFileSystemPath(fromUrl, toUrl)) {
    throw new Error(
      `cannot copy directory content, source and destination are the same (${fromPath})`,
    );
  }

  const copyOperation = Abort.startOperation();
  copyOperation.addAbortSignal(signal);
  try {
    copyOperation.throwIfAborted();
    const directoryEntries = await readDirectory(fromUrl);
    await Promise.all(
      directoryEntries.map(async (directoryEntry) => {
        const from = resolveUrl(directoryEntry, fromUrl);
        const to = resolveUrl(directoryEntry, toUrl);
        await copyOperation.withSignal(async (signal) => {
          await copyEntry({
            signal,
            from,
            to,
            overwrite,
            followLink,
          });
        });
      }),
    );
  } finally {
    await copyOperation.end();
  }
};
