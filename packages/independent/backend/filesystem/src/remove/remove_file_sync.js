import { removeEntrySync } from "./remove_entry_sync.js";

export const removeFileSync = (url, options) => {
  removeEntrySync(url, options);
};
