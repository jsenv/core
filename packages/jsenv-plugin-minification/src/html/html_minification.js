import { createRequire } from "node:module";

// https://github.com/kangax/html-minifier#options-quick-reference
export const minifyHtml = ({ htmlUrlInfo, options } = {}) => {
  const require = createRequire(import.meta.url);
  const { minify } = require("html-minifier");

  const {
    // usually HTML will contain a few markup, it's better to keep white spaces
    // and line breaks to favor readability. A few white spaces means very few
    // octets that won't impact performances. Removing whitespaces however will certainly
    // decrease HTML readability
    collapseWhitespace = false,
    // saving a fewline breaks won't hurt performances
    // but will help a lot readability
    preserveLineBreaks = true,
    removeComments = true,
    conservativeCollapse = false,
  } = options;

  const htmlMinified = minify(htmlUrlInfo.content, {
    collapseWhitespace,
    conservativeCollapse,
    removeComments,
    preserveLineBreaks,
  });
  return htmlMinified;
};
