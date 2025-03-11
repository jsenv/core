import {
  ensurePathnameTrailingSlash,
  resolveUrl,
  urlToFileSystemPath,
} from "@jsenv/urls";
import {
  closeSync,
  openSync,
  readdirSync,
  rmdirSync,
  unlinkSync,
} from "node:fs";

import { assertAndNormalizeFileUrl } from "../path_and_url/file_url_validation.js";
import { readEntryStatSync } from "../read_write/stat/read_entry_stat_sync.js";
import { generateWindowsEPERMErrorMessage } from "../window_eperm_error.js";

export const removeEntrySync = (
  source,
  {
    allowUseless = false,
    recursive = false,
    maxRetries = 3,
    retryDelay = 100,
    onlyContent = false,
  } = {},
) => {
  const sourceUrl = assertAndNormalizeFileUrl(source);
  const sourceStats = readEntryStatSync(sourceUrl, {
    nullIfNotFound: true,
    followLink: false,
  });
  if (!sourceStats) {
    if (allowUseless) {
      return;
    }
    throw new Error(`nothing to remove at ${urlToFileSystemPath(sourceUrl)}`);
  }

  // https://nodejs.org/dist/latest-v13.x/docs/api/fs.html#fs_class_fs_stats
  // FIFO and socket are ignored, not sure what they are exactly and what to do with them
  // other libraries ignore them, let's do the same.
  if (
    sourceStats.isFile() ||
    sourceStats.isSymbolicLink() ||
    sourceStats.isCharacterDevice() ||
    sourceStats.isBlockDevice()
  ) {
    removeNonDirectory(
      sourceUrl.endsWith("/") ? sourceUrl.slice(0, -1) : sourceUrl,
      {
        maxRetries,
        retryDelay,
      },
    );
  } else if (sourceStats.isDirectory()) {
    const directoryUrl = ensurePathnameTrailingSlash(sourceUrl);
    removeDirectorySync(directoryUrl, {
      recursive,
      maxRetries,
      retryDelay,
      onlyContent,
    });
  }
};

const removeNonDirectory = (sourceUrl) => {
  const sourcePath = urlToFileSystemPath(sourceUrl);
  const attempt = () => {
    unlinkSyncNaive(sourcePath);
  };
  attempt();
};

const unlinkSyncNaive = (sourcePath, { handleTemporaryError = null } = {}) => {
  try {
    unlinkSync(sourcePath);
  } catch (error) {
    if (error.code === "ENOENT") {
      return;
    }
    if (
      handleTemporaryError &&
      (error.code === "EBUSY" ||
        error.code === "EMFILE" ||
        error.code === "ENFILE" ||
        error.code === "ENOENT")
    ) {
      handleTemporaryError(error);
      return;
    }
    throw error;
  }
};

const removeDirectorySync = (
  rootDirectoryUrl,
  { maxRetries, retryDelay, recursive, onlyContent },
) => {
  const visit = (sourceUrl) => {
    const sourceStats = readEntryStatSync(sourceUrl, {
      nullIfNotFound: true,
      followLink: false,
    });

    // file/directory not found
    if (sourceStats === null) {
      return;
    }

    if (
      sourceStats.isFile() ||
      sourceStats.isCharacterDevice() ||
      sourceStats.isBlockDevice()
    ) {
      visitFile(sourceUrl);
    } else if (sourceStats.isSymbolicLink()) {
      visitSymbolicLink(sourceUrl);
    } else if (sourceStats.isDirectory()) {
      visitDirectory(`${sourceUrl}/`);
    }
  };

  const visitDirectory = (directoryUrl) => {
    const directoryPath = urlToFileSystemPath(directoryUrl);
    const optionsFromRecursive = recursive
      ? {
          handleNotEmptyError: () => {
            removeDirectoryContent(directoryUrl);
            visitDirectory(directoryUrl);
          },
        }
      : {};
    removeDirectorySyncNaive(directoryPath, {
      ...optionsFromRecursive,
      // Workaround for https://github.com/joyent/node/issues/4337
      ...(process.platform === "win32"
        ? {
            handlePermissionError: (error) => {
              console.error(
                `trying to fix windows EPERM after readir on ${directoryPath}`,
              );

              let openOrCloseError;
              try {
                const fd = openSync(directoryPath);
                closeSync(fd);
              } catch (e) {
                openOrCloseError = e;
              }

              if (openOrCloseError) {
                if (openOrCloseError.code === "ENOENT") {
                  return;
                }
                console.error(
                  generateWindowsEPERMErrorMessage(openOrCloseError, {
                    path: directoryPath,
                    operation: "readir",
                  }),
                );
                throw error;
              }
              removeDirectorySyncNaive(directoryPath, {
                ...optionsFromRecursive,
              });
            },
          }
        : {}),
    });
  };

  const removeDirectoryContent = (directoryUrl) => {
    const entryNames = readdirSync(new URL(directoryUrl));
    for (const entryName of entryNames) {
      const url = resolveUrl(entryName, directoryUrl);
      visit(url);
    }
  };

  const visitFile = (fileUrl) => {
    removeNonDirectory(fileUrl, { maxRetries, retryDelay });
  };

  const visitSymbolicLink = (symbolicLinkUrl) => {
    removeNonDirectory(symbolicLinkUrl, { maxRetries, retryDelay });
  };

  if (onlyContent) {
    removeDirectoryContent(rootDirectoryUrl);
  } else {
    visitDirectory(rootDirectoryUrl);
  }
};

const removeDirectorySyncNaive = (
  directoryPath,
  { handleNotEmptyError = null, handlePermissionError = null } = {},
) => {
  try {
    rmdirSync(directoryPath);
  } catch (error) {
    if (handlePermissionError && error.code === "EPERM") {
      handlePermissionError(error);
      return;
    }
    if (error.code === "ENOENT") {
      return;
    }
    if (
      handleNotEmptyError &&
      // linux os
      (error.code === "ENOTEMPTY" ||
        // SunOS
        error.code === "EEXIST")
    ) {
      handleNotEmptyError(error);
      return;
    }
    throw error;
  }
};
