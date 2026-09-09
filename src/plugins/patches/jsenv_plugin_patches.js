/*
 * Text patches applied to files as they are served and built, keyed by file:
 *
 *   patches: {
 *     "preact/dist/preact.mjs": [{ from: "a&&b", to: "a&&b&&c" }],
 *   }
 *
 * A key is a url pattern relative to the root directory ("./main.js",
 * "**\/*.css"), or a path inside a package ("preact/dist/preact.mjs") found by
 * walking up from the root directory into node_modules, the way node does,
 * so the key holds wherever the package manager hoists the package.
 *
 * Every `from` must occur exactly once in the file, otherwise the file fails
 * to cook and says which patch did not apply: a dependency update that moved
 * the patched code must be looked at, never silently unpatched.
 */

import { createMagicSource } from "@jsenv/sourcemap";
import { URL_META } from "@jsenv/url-meta";
import { asUrlWithoutSearch, urlToRelativeUrl } from "@jsenv/urls";
import { existsSync } from "node:fs";

export const jsenvPluginPatches = (rawPatches) => {
  if (!rawPatches || Object.keys(rawPatches).length === 0) {
    return [];
  }
  let findPatches;
  const patchesPlugin = {
    name: "jsenv:patches",
    appliesDuring: "*",
    init: (context) => {
      const { rootDirectoryUrl } = context;
      const patchesByPattern = {};
      for (const key of Object.keys(rawPatches)) {
        const patches = rawPatches[key];
        assertPatches(patches, key);
        patchesByPattern[resolvePatchKey(key, rootDirectoryUrl)] = patches;
      }
      const associations = URL_META.resolveAssociations(
        { patches: patchesByPattern },
        rootDirectoryUrl,
      );
      findPatches = (url) => {
        const { patches } = URL_META.applyAssociations({
          url: asUrlWithoutSearch(url),
          associations,
        });
        return patches;
      };
    },
    transformUrlContent: (urlInfo) => {
      const patches = findPatches(urlInfo.url);
      if (!patches) {
        return null;
      }
      const { content } = urlInfo;
      const magicSource = createMagicSource(content);
      for (const { from, to } of patches) {
        const start = content.indexOf(from);
        const occurrenceCount =
          start === -1 ? 0 : content.indexOf(from, start + 1) === -1 ? 1 : 2;
        if (occurrenceCount !== 1) {
          const fileRelativeUrl = urlToRelativeUrl(
            urlInfo.url,
            urlInfo.context.rootDirectoryUrl,
          );
          throw new Error(
            `patch cannot apply on "${fileRelativeUrl}": ${JSON.stringify(from)} found ${occurrenceCount === 0 ? "nowhere" : "more than once"} in the file. The file may have changed since the patch was written.`,
          );
        }
        magicSource.replace({
          start,
          end: start + from.length,
          replacement: to,
        });
      }
      return magicSource.toContentAndSourcemap();
    },
  };
  return [patchesPlugin];
};

const assertPatches = (patches, key) => {
  if (!Array.isArray(patches)) {
    throw new TypeError(
      `patches["${key}"] must be an array of { from, to }, got ${patches}`,
    );
  }
  for (const patch of patches) {
    if (
      !patch ||
      typeof patch.from !== "string" ||
      patch.from === "" ||
      typeof patch.to !== "string"
    ) {
      throw new TypeError(
        `patches["${key}"] entries must be { from: string, to: string } with a non-empty "from"`,
      );
    }
  }
};

// "./x", "../x", "/x", "file:///x" and "**/x" are url patterns; anything
// else names a path inside a package, looked up in node_modules
const resolvePatchKey = (key, rootDirectoryUrl) => {
  if (
    key.startsWith("./") ||
    key.startsWith("../") ||
    key.startsWith("/") ||
    key.startsWith("file:") ||
    key.startsWith("*")
  ) {
    return key;
  }
  const segments = key.split("/");
  const packageName = key.startsWith("@")
    ? `${segments[0]}/${segments[1]}`
    : segments[0];
  const pathInsidePackage = key.slice(packageName.length);
  let directoryUrl = new URL(rootDirectoryUrl);
  while (true) {
    const packageDirectoryUrl = new URL(
      `./node_modules/${packageName}/`,
      directoryUrl,
    );
    if (existsSync(packageDirectoryUrl)) {
      return String(new URL(`.${pathInsidePackage}`, packageDirectoryUrl));
    }
    const parentDirectoryUrl = new URL("../", directoryUrl);
    if (parentDirectoryUrl.href === directoryUrl.href) {
      throw new Error(
        `patches["${key}"]: package "${packageName}" not found in any node_modules above ${rootDirectoryUrl}`,
      );
    }
    directoryUrl = parentDirectoryUrl;
  }
};
