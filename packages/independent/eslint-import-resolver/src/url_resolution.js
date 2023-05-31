import { ensureWindowsDriveLetter } from "@jsenv/filesystem";

export const applyUrlResolution = (specifier, importer) => {
  const url = new URL(specifier, importer).href;
  return ensureWindowsDriveLetter(url, importer);
};
