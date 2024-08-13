import { brotliCompress, constants } from "node:zlib";

export const name = "brotli";

export const transform = (
  value,
  {
    quality = constants.BROTLI_MAX_QUALITY,
    size = Buffer.from(value).length,
    ...rest
  } = {},
) => {
  return new Promise((resolve, reject) => {
    brotliCompress(
      value,
      {
        params: {
          [constants.BROTLI_PARAM_QUALITY]: quality,
          [constants.BROTLI_PARAM_SIZE_HINT]:
            typeof size === "number" ? size : 0,
          ...rest,
        },
      },
      (error, buffer) => {
        if (error) {
          reject(error);
        } else {
          resolve(buffer);
        }
      },
    );
  });
};
