/*
 * - symlink documentation on Node.js:
 *   https://nodejs.org/docs/latest-v13.x/api/fs.html#fs_fs_symlink_target_path_type_callback
 */

import { readlinkSync } from "node:fs";
import { isFileSystemPath, fileSystemPathToUrl } from "@jsenv/urls";

import { assertAndNormalizeFileUrl } from "../path_and_url/file_url_validation.js";

export const readSymbolicLinkSync = (url) => {
  const symbolicLinkUrl = assertAndNormalizeFileUrl(url);
  const resolvedPath = readlinkSync(new URL(symbolicLinkUrl));
  return isFileSystemPath(resolvedPath)
    ? fileSystemPathToUrl(resolvedPath)
    : resolvedPath.replace(/\\/g, "/"); // replace back slashes with slashes
};
