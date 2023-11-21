import { readFileSync } from "node:fs";
import { CONTENT_TYPE } from "@jsenv/utils/src/content_type/content_type.js";

import { ensureUnixLineBreaks } from "./line_break_unix.js";

export const readFileContent = (fileUrl) => {
  const isTextual = CONTENT_TYPE.isTextual(
    CONTENT_TYPE.fromUrlExtension(fileUrl),
  );
  const content = readFileSync(fileUrl, isTextual ? "utf8" : null);

  return isTextual && process.platform === "win32"
    ? ensureUnixLineBreaks(content)
    : content;
};
