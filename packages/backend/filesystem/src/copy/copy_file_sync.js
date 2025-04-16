import { copyEntrySync } from "./copy_entry_sync.js";

export const copyFileSync = ({ from, to, ...options }) => {
  copyEntrySync({
    from,
    to,
    ...options,
  });
};
