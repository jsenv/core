import { utimes } from "node:fs";

import { assertAndNormalizeFileUrl } from "./file_url_validation.js";

export const writeEntryModificationTime = (source, mtime) => {
  const sourceUrl = assertAndNormalizeFileUrl(source);
  const mtimeValue =
    typeof mtime === "number" ? new Date(Math.floor(mtime)) : mtime;
  // reading atime mutates its value so there is no use case I can think of
  // where we want to modify it
  const atimeValue = mtimeValue;

  return new Promise((resolve, reject) => {
    utimes(new URL(sourceUrl), atimeValue, mtimeValue, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
};
