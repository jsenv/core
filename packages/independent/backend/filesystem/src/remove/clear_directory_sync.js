import { URL_META } from "@jsenv/url-meta";
import { readdirSync } from "node:fs";
import { readEntryStatSync } from "../read_write/stat/read_entry_stat_sync.js";
import { removeEntrySync } from "./remove_entry_sync.js";

export const clearDirectorySync = (
  initialDirectoryUrl,
  secondArg,
  thirdArg,
) => {
  let removePatterns = {};
  if (secondArg && typeof secondArg === "object") {
    removePatterns = secondArg;
  } else {
    removePatterns = {};
    let clearPatterns = secondArg || "**/*";
    let keepPatterns = thirdArg || [];

    if (typeof keepPatterns === "string") {
      keepPatterns = [keepPatterns];
    }
    if (Array.isArray(keepPatterns)) {
      for (const keepPattern of keepPatterns) {
        Object.assign(removePatterns, {
          [keepPattern]: false,
        });
      }
    }
    if (typeof clearPatterns === "string") {
      clearPatterns = [clearPatterns];
    }
    if (Array.isArray(clearPatterns)) {
      let someClearPatternHandleNodeModules = false;
      for (const clearPattern of clearPatterns) {
        Object.assign(removePatterns, {
          [clearPatterns]: true,
        });
        if (
          !someClearPatternHandleNodeModules &&
          clearPattern.includes("node_modules")
        ) {
          someClearPatternHandleNodeModules = true;
        }
      }
      Object.assign(removePatterns, {
        "**/.*": false,
        "**/.*/": false,
      });
      if (!someClearPatternHandleNodeModules) {
        Object.assign(removePatterns, {
          "**/node_modules/": false,
        });
      }
    }
  }

  const associations = URL_META.resolveAssociations(
    { remove: removePatterns },
    initialDirectoryUrl,
  );
  const visitDirectory = (directoryUrl) => {
    let entryNames;
    try {
      entryNames = readdirSync(new URL(directoryUrl));
    } catch (e) {
      if (e.code === "ENOENT") {
        return;
      }
      throw e;
    }

    for (const entryName of entryNames) {
      const entryUrl = new URL(entryName, directoryUrl);
      let entryStat;
      try {
        entryStat = readEntryStatSync(entryUrl);
      } catch (e) {
        if (e && e.code === "ENOENT") {
          continue;
        }
        throw e;
      }

      if (entryStat.isDirectory()) {
        const subDirectoryUrl = new URL(`${entryName}/`, directoryUrl);
        const meta = URL_META.applyAssociations({
          url: subDirectoryUrl,
          associations,
        });
        if (meta.remove) {
          removeEntrySync(subDirectoryUrl, {
            recursive: true,
            allowUseless: true,
          });
          continue;
        }
        if (
          !URL_META.urlChildMayMatch({
            url: subDirectoryUrl,
            associations,
            predicate: ({ remove }) => remove,
          })
        ) {
          continue;
        }
        visitDirectory(subDirectoryUrl);
        continue;
      }
      const meta = URL_META.applyAssociations({
        url: entryUrl,
        associations,
      });
      if (meta.remove) {
        removeEntrySync(entryUrl, { allowUseless: true });
        continue;
      }
    }
  };
  visitDirectory(initialDirectoryUrl);
};
