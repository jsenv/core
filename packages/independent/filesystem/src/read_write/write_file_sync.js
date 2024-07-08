import {
  writeFileSync as writeFileSyncNode,
  mkdirSync,
  readFileSync,
} from "node:fs";

import { assertAndNormalizeFileUrl } from "../path_and_url/file_url_validation.js";

export const writeFileSync = (destination, content = "") => {
  const destinationUrl = assertAndNormalizeFileUrl(destination);
  const destinationUrlObject = new URL(destinationUrl);
  if (content && content instanceof URL) {
    content = readFileSync(content);
  }
  try {
    writeFileSyncNode(destinationUrlObject, content);
  } catch (error) {
    if (error.code === "ENOENT") {
      mkdirSync(new URL("./", destinationUrlObject), {
        recursive: true,
      });
      writeFileSyncNode(destinationUrlObject, content);
      return;
    }
    throw error;
  }
};
