/*
 * - stats object documentation on Node.js
 *   https://nodejs.org/docs/latest-v13.x/api/fs.html#fs_class_fs_stats
 */

import { urlToFileSystemPath } from "@jsenv/urls";
import { lstat, stat } from "node:fs";

import { assertAndNormalizeFileUrl } from "../../path_and_url/file_url_validation.js";
import { generateWindowsEPERMErrorMessage } from "../../window_eperm_error.js";
import { writeEntryPermissions } from "./write_entry_permissions.js";

const isWindows = process.platform === "win32";

export const readEntryStat = async (
  source,
  { nullIfNotFound = false, followLink = true } = {},
) => {
  let sourceUrl = assertAndNormalizeFileUrl(source);
  if (sourceUrl.endsWith("/")) sourceUrl = sourceUrl.slice(0, -1);

  const sourcePath = urlToFileSystemPath(sourceUrl);

  const handleNotFoundOption = nullIfNotFound
    ? {
        handleNotFoundError: () => null,
      }
    : {};

  return readStat(sourcePath, {
    followLink,
    ...handleNotFoundOption,
    ...(isWindows
      ? {
          // Windows can EPERM on stat
          handlePermissionDeniedError: async (error) => {
            console.error(
              `trying to fix windows EPERM after stats on ${sourcePath}`,
            );

            try {
              // unfortunately it means we mutate the permissions
              // without being able to restore them to the previous value
              // (because reading current permission would also throw)
              await writeEntryPermissions(sourceUrl, 0o666);
              const stats = await readStat(sourcePath, {
                followLink,
                ...handleNotFoundOption,
                // could not fix the permission error, give up and throw original error
                handlePermissionDeniedError: () => {
                  console.error(`still got EPERM after stats on ${sourcePath}`);
                  throw error;
                },
              });
              return stats;
            } catch (e) {
              console.error(
                generateWindowsEPERMErrorMessage(e, {
                  operation: "stats",
                  path: sourcePath,
                }),
              );
              throw error;
            }
          },
        }
      : {}),
  });
};

const readStat = (
  sourcePath,
  {
    followLink,
    handleNotFoundError = null,
    handlePermissionDeniedError = null,
  } = {},
) => {
  const nodeMethod = followLink ? stat : lstat;

  return new Promise((resolve, reject) => {
    nodeMethod(sourcePath, (error, statsObject) => {
      if (error) {
        if (handleNotFoundError && error.code === "ENOENT") {
          resolve(handleNotFoundError(error));
        } else if (
          handlePermissionDeniedError &&
          (error.code === "EPERM" || error.code === "EACCES")
        ) {
          resolve(handlePermissionDeniedError(error));
        } else {
          reject(error);
        }
      } else {
        resolve(statsObject);
      }
    });
  });
};
