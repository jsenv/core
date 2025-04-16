import { readFileSync } from "@jsenv/filesystem";
import { normalizeImportMap } from "@jsenv/importmap";

export const readImportmapFromFile = (importmapFileUrl) => {
  const importmapFileBuffer = readFileSync(importmapFileUrl, { as: "buffer" });
  const importmapFileString = String(importmapFileBuffer);
  const importMap = JSON.parse(importmapFileString);
  return normalizeImportMap(importMap, importmapFileUrl);
};
