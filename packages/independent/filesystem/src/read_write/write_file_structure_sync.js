import { ensureEmptyDirectorySync } from "../remove/ensure_empty_directory_sync.js";
import { readFileStructureSync } from "./read_file_structure_sync.js";
import { writeFileSync } from "./write_file_sync.js";

export const writeFileStructureSync = (directoryUrl, fileStructure) => {
  ensureEmptyDirectorySync(directoryUrl);
  if (fileStructure) {
    if (typeof fileStructure === "string" || fileStructure instanceof URL) {
      fileStructure = readFileStructureSync(fileStructure);
    }
    Object.keys(fileStructure).forEach((relativeUrl) => {
      const fileUrl = new URL(relativeUrl, directoryUrl);
      const fileContent = fileStructure[relativeUrl];
      writeFileSync(fileUrl, fileContent);
    });
  }
};
