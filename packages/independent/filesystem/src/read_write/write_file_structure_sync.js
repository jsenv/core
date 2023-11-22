import { ensureEmptyDirectorySync } from "../remove/ensure_empty_directory_sync.js";
import { writeFileSync } from "./write_file_sync.js";

export const writeFileStructureSync = (directoryUrl, fileContents) => {
  ensureEmptyDirectorySync(directoryUrl);
  Object.keys(fileContents).forEach((relativeUrl) => {
    const contentUrl = new URL(relativeUrl, directoryUrl);
    const content = fileContents[relativeUrl];
    writeFileSync(contentUrl, content);
  });
};
