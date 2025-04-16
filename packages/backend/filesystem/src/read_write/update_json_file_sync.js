import { readFileSync } from "./read_file_sync.js";
import { writeFileSync } from "./write_file_sync.js";

export const updateJsonFileSync = (fileUrl, values = {}) => {
  try {
    const jsonString = readFileSync(fileUrl, { as: "string" });
    const json = JSON.parse(jsonString);
    const newContent = { ...json };
    for (const key of Object.keys(values)) {
      const value = values[key];
      newContent[key] = value;
    }
    let jsonFormatted;
    if (jsonString.startsWith("{\n")) {
      jsonFormatted = JSON.stringify(newContent, null, "  ");
    } else {
      jsonFormatted = JSON.stringify(newContent);
    }
    writeFileSync(fileUrl, jsonFormatted);
  } catch (e) {
    if (e.code === "ENOENT") {
      writeFileSync(fileUrl, JSON.stringify(values));
      return;
    }
    throw e;
  }
};
