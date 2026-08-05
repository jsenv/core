/*
 * The .html files under the served directory, as urls one can navigate to.
 *
 * Lives here, next to the plugin that owns the filesystem, because more than
 * one feature wants the same list: the client dashboard sends a browser to one
 * of them, the page switcher (cmd+K) opens one in the current tab. Whoever asks
 * gets the same answer.
 *
 * Scanned on demand rather than watched: the list is asked for when a human
 * opens a picker, which is rare and never on a hot path, and a short cache is
 * enough to keep a burst of asks from walking the tree twice.
 */

import { urlToRelativeUrl } from "@jsenv/urls";
import { readdirSync } from "node:fs";

const SCAN_TTL_MS = 5000;
// Directories that hold no page worth navigating to: dependencies, build
// output, jsenv's own caches. Dot-directories are skipped separately (.git,
// .agents, …), so they are not listed here.
const SKIP_DIRECTORY_NAME_SET = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
  "git_ignored",
  "old",
]);

export const createHtmlPageLister = ({ rootDirectoryUrl }) => {
  let cache = null;
  let cachedAt = 0;

  return () => {
    if (!rootDirectoryUrl) {
      return [];
    }
    const now = Date.now();
    if (cache && now - cachedAt < SCAN_TTL_MS) {
      return cache;
    }
    const pages = [];
    const walk = (directoryUrl) => {
      let entries;
      try {
        entries = readdirSync(new URL(directoryUrl), { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const name = entry.name;
        if (name[0] === ".") {
          continue;
        }
        if (entry.isDirectory()) {
          if (!SKIP_DIRECTORY_NAME_SET.has(name)) {
            walk(`${directoryUrl}${name}/`);
          }
        } else if (name.endsWith(".html")) {
          pages.push(
            `/${urlToRelativeUrl(`${directoryUrl}${name}`, rootDirectoryUrl)}`,
          );
        }
      }
    };
    walk(String(rootDirectoryUrl));
    pages.sort();
    cache = pages;
    cachedAt = now;
    return pages;
  };
};
