/*
 * - symlink documentation on Node.js:
 *   https://nodejs.org/docs/latest-v13.x/api/fs.html#fs_fs_symlink_target_path_type_callback
 */

import { fileSystemPathToUrl, isFileSystemPath } from "@jsenv/urls";
import { readlink } from "node:fs";

import { assertAndNormalizeFileUrl } from "../path_and_url/file_url_validation.js";

export const readSymbolicLink = (url) => {
  const symbolicLinkUrl = assertAndNormalizeFileUrl(url);

  return new Promise((resolve, reject) => {
    readlink(new URL(symbolicLinkUrl), (error, resolvedPath) => {
      if (error) {
        reject(error);
      } else {
        resolve(
          isFileSystemPath(resolvedPath)
            ? fileSystemPathToUrl(resolvedPath)
            : resolvedPath.replace(/\\/g, "/"), // replace back slashes with slashes
        );
      }
    });
  });
};
