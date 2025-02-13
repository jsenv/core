import { readFileSync } from "@jsenv/filesystem";
import { normalizeImportMap } from "@jsenv/importmap";
import { fileURLToPath } from "node:url";

import { applyUrlResolution } from "./url_resolution.js";

export const readImportmap = ({
  logger,
  rootDirectoryUrl,
  importmapFileRelativeUrl,
}) => {
  if (typeof importmapFileRelativeUrl === "undefined") {
    return null;
  }
  if (typeof importmapFileRelativeUrl !== "string") {
    throw new TypeError(
      `importmapFileRelativeUrl must be a string, got ${importmapFileRelativeUrl}`,
    );
  }
  const importmapFileUrl = applyUrlResolution(
    importmapFileRelativeUrl,
    rootDirectoryUrl,
  );
  if (!importmapFileUrl.startsWith(`${rootDirectoryUrl}`)) {
    logger.warn(`import map file is outside root directory.
--- import map file ---
${fileURLToPath(importmapFileUrl)}
--- root directory ---
${fileURLToPath(rootDirectoryUrl)}`);
  }
  let importmapFileBuffer;
  try {
    importmapFileBuffer = readFileSync(importmapFileUrl, { as: "buffer" });
  } catch (e) {
    if (e && e.code === "ENOENT") {
      logger.error(`importmap file not found at ${importmapFileUrl}`);
      return null;
    }
    throw e;
  }
  let importMap;
  try {
    const importmapFileString = String(importmapFileBuffer);
    importMap = JSON.parse(importmapFileString);
  } catch (e) {
    if (e && e.code === "SyntaxError") {
      logger.error(`syntax error in importmap file
--- error stack ---
${e.stack}
--- importmap file ---
${importmapFileUrl}`);
      return null;
    }
    throw e;
  }
  return normalizeImportMap(importMap, importmapFileUrl);
};
