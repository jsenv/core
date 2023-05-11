import { readEntryStat } from "./readEntryStat.js";

export const readEntryModificationTime = async (source) => {
  const stats = await readEntryStat(source);
  return Math.floor(stats.mtimeMs);
};
