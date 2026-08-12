// A bare specifier ("preact", "@jsenv/core/x.js") is resolved by node esm resolution,
// everything else ("/a.js", "./a.js", "http://example.com/a.js") by url resolution
export const isBareSpecifier = (specifier) => {
  if (
    specifier[0] === "/" ||
    specifier.startsWith("./") ||
    specifier.startsWith("../")
  ) {
    return false;
  }
  try {
    // eslint-disable-next-line no-new
    new URL(specifier);
    return false;
  } catch {
    return true;
  }
};
