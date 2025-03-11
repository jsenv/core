import { readFileStructureSync } from "../read_write/read_file_structure_sync.js";
import { writeFileStructureSync } from "../read_write/write_file_structure_sync.js";

export const replaceFileStructureSync = ({ from, to }) => {
  writeFileStructureSync(to, readFileStructureSync(from));
};
