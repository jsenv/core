import { createRequire } from "node:module";

// https://github.com/kangax/html-minifier#options-quick-reference
export const minifyHtml = ({ htmlUrlInfo, options } = {}) => {
  const require = createRequire(import.meta.url);
  const { minify } = require("html-minifier");

  const { collapseWhitespace = true, removeComments = true } = options;

  const htmlMinified = minify(htmlUrlInfo.content, {
    collapseWhitespace,
    removeComments,
  });
  return htmlMinified;
};
