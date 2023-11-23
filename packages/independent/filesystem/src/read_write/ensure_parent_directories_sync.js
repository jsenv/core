import { dirname } from "node:path";
import { urlToFileSystemPath } from "@jsenv/urls";

import { assertAndNormalizeFileUrl } from "../path_and_url/file_url_validation.js";
import { writeDirectorySync } from "./write_directory_sync.js";

export const ensureParentDirectoriesSync = (destination) => {
  const destinationUrl = assertAndNormalizeFileUrl(destination);
  const destinationPath = urlToFileSystemPath(destinationUrl);
  const destinationParentPath = dirname(destinationPath);

  writeDirectorySync(destinationParentPath, {
    recursive: true,
    allowUseless: true,
  });
};
