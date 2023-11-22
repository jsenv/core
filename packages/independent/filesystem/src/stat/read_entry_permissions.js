/*
 * - file modes documentation on Node.js
 *   https://nodejs.org/docs/latest-v13.x/api/fs.html#fs_file_modes
 */

import { promises } from "node:fs";
import { urlToFileSystemPath } from "@jsenv/urls";

import { assertAndNormalizeFileUrl } from "../path_and_url/file_url_validation.js";
import { binaryFlagsToPermissions } from "./permissions.js";

const { stat } = promises;

export const readEntryPermissions = async (source) => {
  const sourceUrl = assertAndNormalizeFileUrl(source);
  const sourcePath = urlToFileSystemPath(sourceUrl);

  const { mode } = await stat(sourcePath);
  return binaryFlagsToPermissions(mode);
};
