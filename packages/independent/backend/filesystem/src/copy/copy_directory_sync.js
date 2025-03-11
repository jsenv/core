import { copyEntrySync } from "./copy_entry_sync.js";

export const copyDirectorySync = ({ from, to, ...options }) => {
  copyEntrySync({
    from,
    to,
    ...options,
  });
};
