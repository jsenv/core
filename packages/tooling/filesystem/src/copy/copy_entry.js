import { Abort } from "@jsenv/abort";
import {
  ensurePathnameTrailingSlash,
  resolveUrl,
  urlIsInsideOf,
  urlToFileSystemPath,
  urlToRelativeUrl,
} from "@jsenv/urls";
import { copyFile as copyFileNode } from "node:fs";

import { assertAndNormalizeFileUrl } from "../path_and_url/file_url_validation.js";
import { urlTargetsSameFileSystemPath } from "../path_and_url/url_targets_same_file_system_path.js";
import { ensureParentDirectories } from "../read_write/ensure_parent_directories.js";
import { readDirectory } from "../read_write/read_directory.js";
import { readSymbolicLink } from "../read_write/read_symbolic_link.js";
import { binaryFlagsToPermissions } from "../read_write/stat/permissions.js";
import { readEntryStat } from "../read_write/stat/read_entry_stat.js";
import { statsToType } from "../read_write/stat/stats_to_type.js";
import { writeEntryModificationTime } from "../read_write/stat/write_entry_modification_time.js";
import { writeEntryPermissions } from "../read_write/stat/write_entry_permissions.js";
import { writeDirectory } from "../read_write/write_directory.js";
import { writeSymbolicLink } from "../read_write/write_symbolic_link.js";
import { removeEntry } from "../remove/remove_entry.js";

export const copyEntry = async ({
  signal = new AbortController().signal,
  from,
  to,
  overwrite = false,
  preserveStat = true,
  preserveMtime = preserveStat,
  preservePermissions = preserveStat,
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
    throw new Error(`nothing to copy at ${fromPath}`);
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
      `cannot copy ${fromPath} because destination and source are the same`,
    );
  }

  if (sourceStats.isDirectory()) {
    toUrl = ensurePathnameTrailingSlash(toUrl);
  }

  const copyOperation = Abort.startOperation();
  copyOperation.addAbortSignal(signal);

  const visit = async (url, stats) => {
    copyOperation.throwIfAborted();
    if (stats.isFile() || stats.isCharacterDevice() || stats.isBlockDevice()) {
      await visitFile(url, stats);
    } else if (stats.isSymbolicLink()) {
      await visitSymbolicLink(url, stats);
    } else if (stats.isDirectory()) {
      await visitDirectory(ensurePathnameTrailingSlash(url), stats);
    }
  };

  const visitFile = async (fileUrl, fileStats) => {
    const fileRelativeUrl = urlToRelativeUrl(fileUrl, fromUrl);
    const fileCopyUrl = resolveUrl(fileRelativeUrl, toUrl);

    await copyFileContentNaive(
      urlToFileSystemPath(fileUrl),
      urlToFileSystemPath(fileCopyUrl),
    );
    await copyStats(fileCopyUrl, fileStats);
  };

  const visitSymbolicLink = async (symbolicLinkUrl) => {
    const symbolicLinkRelativeUrl = urlToRelativeUrl(symbolicLinkUrl, fromUrl);
    const symbolicLinkTarget = await readSymbolicLink(symbolicLinkUrl);
    const symbolicLinkTargetUrl = resolveUrl(
      symbolicLinkTarget,
      symbolicLinkUrl,
    );
    const linkIsRelative =
      symbolicLinkTarget.startsWith("./") ||
      symbolicLinkTarget.startsWith("../");

    let symbolicLinkCopyTarget;
    if (symbolicLinkTargetUrl === fromUrl) {
      symbolicLinkCopyTarget = linkIsRelative ? symbolicLinkTarget : toUrl;
    } else if (urlIsInsideOf(symbolicLinkTargetUrl, fromUrl)) {
      // symbolic link targets something inside the directory we want to copy
      // reflects it inside the copied directory structure
      const linkCopyTargetRelative = urlToRelativeUrl(
        symbolicLinkTargetUrl,
        fromUrl,
      );
      symbolicLinkCopyTarget = linkIsRelative
        ? `./${linkCopyTargetRelative}`
        : resolveUrl(linkCopyTargetRelative, toUrl);
    } else {
      // symbolic link targets something outside the directory we want to copy
      symbolicLinkCopyTarget = symbolicLinkTarget;
    }

    // we must guess ourself the type of the symlink
    // because the destination might not exists because not yet copied
    // https://nodejs.org/dist/latest-v13.x/docs/api/fs.html#fs_fs_symlink_target_path_type_callback
    const targetStats = await readEntryStat(symbolicLinkTargetUrl, {
      nullIfNotFound: true,
      followLink: false,
    });
    const linkType = targetStats && targetStats.isDirectory() ? "dir" : "file";

    const symbolicLinkCopyUrl = resolveUrl(symbolicLinkRelativeUrl, toUrl);
    await writeSymbolicLink({
      from: symbolicLinkCopyUrl,
      to: symbolicLinkCopyTarget,
      type: linkType,
    });
  };

  const copyStats = async (toUrl, stats) => {
    if (preservePermissions || preserveMtime) {
      const { mode, mtimeMs } = stats;
      if (preservePermissions) {
        await writeEntryPermissions(toUrl, binaryFlagsToPermissions(mode));
      }
      if (preserveMtime) {
        await writeEntryModificationTime(toUrl, mtimeMs);
      }
    }
  };

  const visitDirectory = async (directoryUrl, directoryStats) => {
    const directoryRelativeUrl = urlToRelativeUrl(directoryUrl, fromUrl);
    const directoryCopyUrl = resolveUrl(directoryRelativeUrl, toUrl);

    await writeDirectory(directoryCopyUrl);
    await copyDirectoryContent(directoryUrl);
    await copyStats(directoryCopyUrl, directoryStats);
  };

  const copyDirectoryContent = async (directoryUrl) => {
    const names = await readDirectory(directoryUrl);
    await Promise.all(
      names.map(async (name) => {
        const entryUrl = resolveUrl(name, directoryUrl);
        const stats = await readEntryStat(entryUrl, {
          followLink: false,
        });
        await visit(entryUrl, stats);
      }),
    );
  };

  try {
    if (destinationStats) {
      const sourceType = statsToType(sourceStats);
      const destinationType = statsToType(destinationStats);

      if (sourceType !== destinationType) {
        throw new Error(
          `cannot copy ${sourceType} from ${fromPath} to ${toPath} because destination exists and is not a ${sourceType} (it's a ${destinationType})`,
        );
      }
      if (!overwrite) {
        throw new Error(
          `cannot copy ${sourceType} from ${fromPath} to ${toPath} because destination exists and overwrite option is disabled`,
        );
      }

      // remove file, link, directory...
      await removeEntry(toUrl, {
        signal: copyOperation.signal,
        recursive: true,
        allowUseless: true,
      });
    } else {
      await ensureParentDirectories(toUrl);
    }

    copyOperation.throwIfAborted();
    await visit(fromUrl, sourceStats);
  } finally {
    await copyOperation.end();
  }
};

const copyFileContentNaive = (filePath, fileDestinationPath) => {
  return new Promise((resolve, reject) => {
    copyFileNode(filePath, fileDestinationPath, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
};
