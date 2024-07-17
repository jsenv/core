import { copyEntrySync } from "../copy/copy_entry_sync.js";

export const replaceFileSync = (from, to) =>
  copyEntrySync({
    from,
    to,
    overwrite: true,
  });
