import { readEntryStatSync } from "./read_entry_stat_sync.js";
import { statsToType } from "./stats_to_type.js";

export const readEntryInfo = (url) => {
  try {
    const stats = readEntryStatSync(new URL(url));
    const type = statsToType(stats);
    return {
      type,
      atimeMs: stats.atimeMs,
      mtimeMs: stats.mtimeMs,
    };
  } catch (e) {
    if (e.code === "ENOENT") {
      return null;
    }
    throw e;
  }
};
