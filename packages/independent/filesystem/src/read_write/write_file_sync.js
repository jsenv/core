import { readFileSync, writeFileSync as writeFileSyncNode } from "node:fs";

import { assertAndNormalizeFileUrl } from "../path_and_url/file_url_validation.js";
import { removeDirectorySync } from "../remove/remove_directory_sync.js";
import { writeDirectorySync } from "./write_directory_sync.js";

export const writeFileSync = (destination, content = "", { force } = {}) => {
  const destinationUrl = assertAndNormalizeFileUrl(destination);
  const destinationUrlObject = new URL(destinationUrl);
  if (content && content instanceof URL) {
    content = readFileSync(content);
  }
  try {
    writeFileSyncNode(destinationUrlObject, content);
  } catch (error) {
    if (error.code === "EISDIR") {
      // happens when directory existed but got deleted and now it's a file
      if (force) {
        removeDirectorySync(destinationUrlObject);
        writeFileSyncNode(destinationUrlObject, content);
      } else {
        throw error;
      }
    }
    if (error.code === "ENOENT" || error.code === "ENOTDIR") {
      writeDirectorySync(new URL("./", destinationUrlObject), {
        force,
        recursive: true,
      });
      writeFileSyncNode(destinationUrlObject, content);
      return;
    }
    throw error;
  }
};
