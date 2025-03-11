import { removeEntrySync } from "./remove_entry_sync.js";

export const removeDirectorySync = (url, options = {}) => {
  return removeEntrySync(url, {
    ...options,
    recursive: true,
  });
};
