import { readFileStructureSync } from "./read_file_structure_sync.js";
import { writeFileStructureSync } from "./write_file_structure_sync.js";

export const saveDirectoryContentSync = (directoryUrl) => {
  const fileStructure = readFileStructureSync(directoryUrl);
  return {
    restore: () => {
      writeFileStructureSync(directoryUrl, fileStructure);
    },
  };
};
