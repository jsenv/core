import { utimesSync } from "node:fs";

import { assertAndNormalizeFileUrl } from "../../path_and_url/file_url_validation.js";

export const writeEntryModificationTimeSync = (source, mtime) => {
  const sourceUrl = assertAndNormalizeFileUrl(source);
  const mtimeValue =
    typeof mtime === "number" ? new Date(Math.floor(mtime)) : mtime;
  // reading atime mutates its value so there is no use case I can think of
  // where we want to modify it
  const atimeValue = mtimeValue;

  utimesSync(new URL(sourceUrl), atimeValue, mtimeValue);
};
