import { writeFileSync, rmSync } from "node:fs";

import { assertAndNormalizeDirectoryUrl } from "../path_and_url/directory_url_validation.js";

export const writeFileStructureSync = (directoryUrl, fileContents) => {
  directoryUrl = assertAndNormalizeDirectoryUrl(directoryUrl);

  try {
    rmSync(new URL(directoryUrl), {
      recursive: true,
      force: true,
    });
  } catch (e) {
    if (!e || e.code !== "ENOENT") {
      throw e;
    }
  }
  Object.keys(fileContents).forEach((relativeUrl) => {
    const contentUrl = new URL(relativeUrl, directoryUrl);
    const content = fileContents[relativeUrl];
    writeFileSync(contentUrl, content);
  });
};
