import { constants, gzip } from "node:zlib";

export const name = "gzip";

export const transform = (
  value,
  { level = constants.Z_MAX_LEVEL, ...rest } = {},
) => {
  return new Promise((resolve, reject) => {
    gzip(value, { level, ...rest }, (error, buffer) => {
      if (error) {
        reject(error);
      } else {
        resolve(buffer);
      }
    });
  });
};
