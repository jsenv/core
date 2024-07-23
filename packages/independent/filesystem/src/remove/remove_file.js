import { removeEntry } from "./remove_entry.js";

export const removeFile = async (url, options) => {
  await removeEntry(url, options);
};
