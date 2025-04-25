import { pathToFileURL } from "node:url";
import { isFileSystemPath } from "../shared/is_filesystem_path.js";

export const fileSystemPathToUrl = (value) => {
  if (!isFileSystemPath(value)) {
    throw new Error(`value must be a filesystem path, got ${value}`);
  }
  return String(pathToFileURL(value));
};
