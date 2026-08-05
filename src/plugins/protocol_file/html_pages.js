/*
 * The .html files under the served directory, as urls one can navigate to.
 *
 * Lives here, next to the plugin that owns the filesystem, because more than
 * one feature wants the same list: the client dashboard sends a browser to one
 * of them, the page switcher (cmd+K) opens one in the current tab. Whoever asks
 * gets the same answer.
 *
 * Each page comes with what kind of page it is, read from where it sits and
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
    const pages = fileResultArray.map(({ relativeUrl, meta }) => ({
      url: `/${relativeUrl}`,
      kind: readKind(meta),
    }));
    cache = pages;
    cachedAt = now;
    return pages;
  };
};
