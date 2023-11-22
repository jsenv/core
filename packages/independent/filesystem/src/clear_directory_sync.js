import { readdirSync, statSync } from "node:fs";
import { URL_META } from "@jsenv/url-meta";

import { removeEntrySync } from "./remove_entry_sync.js";

export const clearDirectorySync = (initialDirectoryUrl, pattern = "**/*") => {
  const associations = URL_META.resolveAssociations(
    {
      clear: {
        [pattern]: true,
        "**/.*": false,
        "**/.*/": false,
        "**/node_modules/": false,
      },
    },
    initialDirectoryUrl,
  );
  const visitDirectory = (directoryUrl) => {
    const entryNames = readdirSync(directoryUrl);
    for (const entryName of entryNames) {
      const entryUrl = new URL(entryName, directoryUrl);
      let entryStat;
      try {
        entryStat = statSync(entryUrl);
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
