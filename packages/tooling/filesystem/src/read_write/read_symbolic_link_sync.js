/*
 * - symlink documentation on Node.js:
 *   https://nodejs.org/docs/latest-v13.x/api/fs.html#fs_fs_symlink_target_path_type_callback
 */

import { fileSystemPathToUrl, isFileSystemPath } from "@jsenv/urls";
import { readlinkSync } from "node:fs";
import { assertAndNormalizeFileUrl } from "../path_and_url/file_url_validation.js";

export const readSymbolicLinkSync = (url) => {
  const symbolicLinkUrl = assertAndNormalizeFileUrl(url);
  const resolvedPath = readlinkSync(
    new URL(
      symbolicLinkUrl.endsWith("/")
        ? symbolicLinkUrl.slice(0, -1)
        : symbolicLinkUrl,
    ),
  );
  return isFileSystemPath(resolvedPath)
    ? fileSystemPathToUrl(resolvedPath)
    : resolvedPath.replace(/\\/g, "/"); // replace back slashes with slashes
};
