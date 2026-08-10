/*
 * The .html files under the served directory, as urls one can navigate to.
 *
 * Lives here, next to the plugin that owns the filesystem, because more than
 * one feature wants the same list: the client dashboard sends a browser to one
 * of them, the page switcher (cmd+K) opens one in the current tab. Whoever asks
 * gets the same answer.
 *
 * Each page comes with where its file is (so it can be opened in an editor as
 * well as in the browser) and with what kind of page it is, read from where it
 * sits and
 * what it is called — the two conventions this repo already follows:
 * - "experiment": something tried out, under a lab/ directory or named
 *   *_experiment.html;
 * - "demo": something shown, under a demos/ directory or named *_demo.html;
 * - "page": everything else.
 *
 * Scanned on demand rather than watched: the list is asked for when a human
 * opens a picker, which is rare and never on a hot path, and a short cache is
 * enough to keep a burst of asks from walking the tree twice.
 */

import { collectFiles } from "@jsenv/filesystem";
import { existsSync } from "node:fs";

const SCAN_TTL_MS = 5000;

// What to walk and what to skip, in the shape @jsenv/url-meta reads: the last
// matching pattern wins, so the exclusions come after the "every .html" rule.
// Dependencies, build output and jsenv's own caches hold no page worth going to.
const HTML_PAGE_ASSOCIATIONS = {
  page: {
    "**/*.html": true,
    "**/.*/": false,
    "**/node_modules/": false,
    "**/dist/": false,
    "**/build/": false,
    "**/coverage/": false,
    "**/git_ignored/": false,
    "**/old/": false,
  },
  experiment: {
    "**/lab/**/*.html": true,
    "**/*_experiment.html": true,
  },
  demo: {
    "**/demos/**/*.html": true,
    "**/*_demo.html": true,
  },
};

// An experiment inside a demos/ directory is an experiment: the more specific
// of the two wins, and "shown" is the weaker claim.
const readKind = (meta) => {
  if (meta.experiment) {
    return "experiment";
  }
  if (meta.demo) {
    return "demo";
  }
  return "page";
};

// Which package a page belongs to: the nearest directory above it holding a
// package.json, said as a url so whoever draws a tree can mark that very node.
// Not the root itself — everything is under it, and "the whole repo" is not a
// package one distinguishes from another. Memoized per directory: a scan asks
// the same question once per file and there are hundreds of them.
const createPackageDirectoryFinder = (rootDirectoryUrl) => {
  const cache = new Map();
  const find = (directoryUrl) => {
    if (cache.has(directoryUrl)) {
      return cache.get(directoryUrl);
    }
    let result = null;
    if (directoryUrl.length > String(rootDirectoryUrl).length) {
      result = existsSync(new URL("./package.json", directoryUrl))
        ? directoryUrl
        : find(new URL("../", directoryUrl).href);
    }
    cache.set(directoryUrl, result);
    return result;
  };
  return find;
};

export const createHtmlPageLister = ({ rootDirectoryUrl }) => {
  let cache = null;
  let cachedAt = 0;

  return async () => {
    if (!rootDirectoryUrl) {
      return [];
    }
    const now = Date.now();
    if (cache && now - cachedAt < SCAN_TTL_MS) {
      return cache;
    }
    const fileResultArray = await collectFiles({
      directoryUrl: rootDirectoryUrl,
      associations: HTML_PAGE_ASSOCIATIONS,
      predicate: (meta) => Boolean(meta.page),
    });
    const findPackageDirectory = createPackageDirectoryFinder(rootDirectoryUrl);
    const pages = fileResultArray.map(({ relativeUrl, meta }) => {
      const fileUrl = new URL(relativeUrl, rootDirectoryUrl).href;
      const packageDirectoryUrl = findPackageDirectory(
        new URL("./", fileUrl).href,
      );
      return {
        url: `/${relativeUrl}`,
        // Where the file actually is, so whoever wants to open it in an editor
        // rather than in the browser has what GET /.internal/open_file/* asks
        // for (a file url) without having to know the root directory.
        fileUrl,
        kind: readKind(meta),
        // Relative to the root and without its trailing slash, which is how a
        // tree names its own nodes.
        packageUrl: packageDirectoryUrl
          ? `/${packageDirectoryUrl.slice(String(rootDirectoryUrl).length).replace(/\/$/, "")}`
          : null,
      };
    });
    cache = pages;
    cachedAt = now;
    return pages;
  };
};
