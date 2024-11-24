import { URL_META } from "@jsenv/url-meta";
import { readdirSync } from "node:fs";
import { readEntryStatSync } from "../read_write/stat/read_entry_stat_sync.js";
import { removeEntrySync } from "./remove_entry_sync.js";

export const clearDirectorySync = (initialDirectoryUrl, pattern = "**/*") => {
  const associations = URL_META.resolveAssociations(
    {
      clear:
        typeof pattern === "string"
          ? {
              [pattern]: true,
              "**/.*": false,
              "**/.*/": false,
              ...(pattern.includes("node_modules")
                ? {}
                : { "**/node_modules/": false }),
            }
          : {
              "**/.*": false,
              "**/.*/": false,
              "**/node_modules/": false,
              ...pattern,
            },
    },
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
        if (meta.clear) {
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
            predicate: ({ clear }) => clear,
          })
        ) {
          continue;
        }
        visitDirectory(subDirectoryUrl);
      }

      const meta = URL_META.applyAssociations({
        url: entryUrl,
        associations,
      });
      if (meta.clear) {
        removeEntrySync(entryUrl, { allowUseless: true });
        continue;
      }
    }
  };
  visitDirectory(initialDirectoryUrl);
};
