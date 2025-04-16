import { readEntryStat } from "./read_entry_stat.js";

export const readEntryModificationTime = async (source) => {
  const stats = await readEntryStat(source);
  return Math.floor(stats.mtimeMs);
};
