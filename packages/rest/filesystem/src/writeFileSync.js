import { writeFileSync as writeFileSyncNode, mkdirSync } from "node:fs";

import { assertAndNormalizeFileUrl } from "./file_url_validation.js";

export const writeFileSync = (destination, content = "") => {
  const destinationUrl = assertAndNormalizeFileUrl(destination);
  const destinationUrlObject = new URL(destinationUrl);
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
