// https://github.com/terser/html-minifier-terser#options-quick-reference
export const minifyHtml = async (htmlUrlInfo, options = {}) => {
  const { minify } = await import("html-minifier-terser");

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
    // comments are sometimes meaningful to whoever reads the HTML after the build:
    // a server injecting content at a marker, an SSI directive, a legal banner, ...
    // these are kept even when removeComments is true.
    // the comment text (without "<!--" and "-->") is tested against each regexp
    // "<!--! ... -->" -> legal/banner comments, same convention as CSS and JS minifiers
    // "<!--# ... -->" -> server side includes
    keepComments = [/^!/, /^\s*#/],
  } = options;

  const htmlMinified = await minify(htmlUrlInfo.content, {
    collapseWhitespace,
    conservativeCollapse,
    removeComments,
    preserveLineBreaks,
    ignoreCustomComments: keepComments,
  });
  return htmlMinified;
};
