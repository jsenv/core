import { CONTENT_TYPE } from "@jsenv/utils/src/content_type/content_type.js";
import { readFileSync as readFileSyncNode } from "node:fs";

import { assertAndNormalizeFileUrl } from "../path_and_url/file_url_validation.js";

export const readFileSync = (value, { as } = {}) => {
  const fileUrl = assertAndNormalizeFileUrl(value);
  if (as === undefined) {
    const contentType = CONTENT_TYPE.fromUrlExtension(fileUrl);
    if (CONTENT_TYPE.isJson(contentType)) {
      as = "json";
    } else if (CONTENT_TYPE.isTextual(contentType)) {
      as = "string";
    } else {
      as = "buffer";
    }
  }
  const buffer = readFileSyncNode(new URL(fileUrl));
  if (as === "buffer") {
    return buffer;
  }
  if (as === "string") {
    return buffer.toString();
  }
  if (as === "json") {
    return JSON.parse(buffer.toString());
  }
  throw new Error(
    `"as" must be one of "buffer","string","json" received "${as}"`,
  );
};
