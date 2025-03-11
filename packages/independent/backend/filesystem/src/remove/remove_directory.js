import { removeEntry } from "./remove_entry.js";

export const removeDirectory = (url, options = {}) => {
  return removeEntry(url, {
    ...options,
    recursive: true,
  });
};
