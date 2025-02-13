import { readFile as readFileNode } from "node:fs";

import { assertAndNormalizeFileUrl } from "../path_and_url/file_url_validation.js";

export const readFile = async (value, { as = "buffer" } = {}) => {
  const fileUrl = assertAndNormalizeFileUrl(value);
  const buffer = await new Promise((resolve, reject) => {
    readFileNode(new URL(fileUrl), (error, buffer) => {
      if (error) {
        reject(error);
      } else {
        resolve(buffer);
      }
    });
  });
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
