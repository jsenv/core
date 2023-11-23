import { copyFileSync as copyFileSyncNode } from "node:fs";
import { Abort } from "@jsenv/abort";
import {
  resolveUrl,
  urlToRelativeUrl,
  ensurePathnameTrailingSlash,
  urlIsInsideOf,
  urlToFileSystemPath,
} from "@jsenv/urls";

import { assertAndNormalizeFileUrl } from "../path_and_url/file_url_validation.js";
import { urlTargetsSameFileSystemPath } from "../path_and_url/url_targets_same_file_system_path.js";
import { readEntryStatSync } from "../read_write/stat/read_entry_stat_sync.js";
import { statsToType } from "../read_write/stat/stats_to_type.js";
import { binaryFlagsToPermissions } from "../read_write/stat/permissions.js";
import { writeEntryPermissionsSync } from "../read_write/stat/write_entry_permissions_sync.js";
import { writeEntryModificationTimeSync } from "../read_write/stat/write_entry_modification_time_sync.js";
import { writeDirectorySync } from "../read_write/write_directory_sync.js";
import { ensureParentDirectoriesSync } from "../read_write/ensure_parent_directories_sync.js";
import { readDirectorySync } from "../read_write/read_directory_sync.js";
import { readSymbolicLinkSync } from "../read_write/read_symbolic_link_sync.js";
import { writeSymbolicLinkSync } from "../read_write/write_symbolic_link_sync.js";
import { removeEntrySync } from "../remove/remove_entry_sync.js";

export const copyEntrySync = ({
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

  const sourceStats = readEntryStatSync(fromUrl, {
    nullIfNotFound: true,
    followLink: false,
  });
  if (!sourceStats) {
    throw new Error(`nothing to copy at ${fromPath}`);
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
      visitFile(url, stats);
    } else if (stats.isSymbolicLink()) {
      visitSymbolicLink(url, stats);
    } else if (stats.isDirectory()) {
      visitDirectory(ensurePathnameTrailingSlash(url), stats);
    }
  };

  const visitFile = (fileUrl, fileStats) => {
    const fileRelativeUrl = urlToRelativeUrl(fileUrl, fromUrl);
    const fileCopyUrl = resolveUrl(fileRelativeUrl, toUrl);

    copyFileSyncNode(
      urlToFileSystemPath(fileUrl),
      urlToFileSystemPath(fileCopyUrl),
    );
    copyStatsSync(fileCopyUrl, fileStats);
  };

  const visitSymbolicLink = (symbolicLinkUrl) => {
    const symbolicLinkRelativeUrl = urlToRelativeUrl(symbolicLinkUrl, fromUrl);
    const symbolicLinkTarget = readSymbolicLinkSync(symbolicLinkUrl);
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
    const targetStats = readEntryStatSync(symbolicLinkTargetUrl, {
      nullIfNotFound: true,
      followLink: false,
    });
    const linkType = targetStats && targetStats.isDirectory() ? "dir" : "file";

    const symbolicLinkCopyUrl = resolveUrl(symbolicLinkRelativeUrl, toUrl);
    writeSymbolicLinkSync({
      from: symbolicLinkCopyUrl,
      to: symbolicLinkCopyTarget,
      type: linkType,
    });
  };

  const copyStatsSync = (toUrl, stats) => {
    if (preservePermissions || preserveMtime) {
      const { mode, mtimeMs } = stats;
      if (preservePermissions) {
        writeEntryPermissionsSync(toUrl, binaryFlagsToPermissions(mode));
      }
      if (preserveMtime) {
        writeEntryModificationTimeSync(toUrl, mtimeMs);
      }
    }
  };

  const visitDirectory = async (directoryUrl, directoryStats) => {
    const directoryRelativeUrl = urlToRelativeUrl(directoryUrl, fromUrl);
    const directoryCopyUrl = resolveUrl(directoryRelativeUrl, toUrl);

    writeDirectorySync(directoryCopyUrl);
    copyDirectoryContentSync(directoryUrl);
    copyStatsSync(directoryCopyUrl, directoryStats);
  };

  const copyDirectoryContentSync = async (directoryUrl) => {
    const names = readDirectorySync(directoryUrl);
    names.forEach((name) => {
      const entryUrl = resolveUrl(name, directoryUrl);
      const stats = readEntryStatSync(entryUrl, {
        followLink: false,
      });
      visit(entryUrl, stats);
    });
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
      removeEntrySync(toUrl, {
        signal: copyOperation.signal,
        recursive: true,
        allowUseless: true,
      });
    } else {
      ensureParentDirectoriesSync(toUrl);
    }

    copyOperation.throwIfAborted();
    visit(fromUrl, sourceStats);
  } finally {
    copyOperation.end();
  }
};
