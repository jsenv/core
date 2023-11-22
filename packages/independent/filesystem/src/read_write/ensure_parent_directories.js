import { dirname } from "node:path";
import { urlToFileSystemPath } from "@jsenv/urls";

import { assertAndNormalizeFileUrl } from "../path_and_url/file_url_validation.js";
import { writeDirectory } from "./write_directory.js";

export const ensureParentDirectories = async (destination) => {
  const destinationUrl = assertAndNormalizeFileUrl(destination);
  const destinationPath = urlToFileSystemPath(destinationUrl);
  const destinationParentPath = dirname(destinationPath);

  await writeDirectory(destinationParentPath, {
    recursive: true,
    allowUseless: true,
  });
};
