import { dirname } from "node:path";
import { urlToFileSystemPath } from "@jsenv/urls";

import { assertAndNormalizeFileUrl } from "./file_url_validation.js";
import { writeDirectory } from "./writeDirectory.js";

export const ensureParentDirectories = async (destination) => {
  const destinationUrl = assertAndNormalizeFileUrl(destination);
  const destinationPath = urlToFileSystemPath(destinationUrl);
  const destinationParentPath = dirname(destinationPath);

  return writeDirectory(destinationParentPath, {
    recursive: true,
    allowUseless: true,
  });
};
